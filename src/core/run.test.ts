import { describe, it, expect, beforeEach } from "vitest";
import {
  startRun,
  advanceTravel,
  applyEncounterOutcome,
  tendCamp,
  tendFires,
  bondedCinder,
  currentStage,
  latitudeFactor,
  stageConditions,
  loadMeta,
  persistMeta,
  isRunOver,
  recruitFromCaught,
  releaseFromCircle,
  inCircle,
  collectMemory,
  hasMemory,
  recoverMemoryInRun,
  STAGES,
} from "./run";
import { FLASHBACKS, unrecoveredFlashbacks } from "./flashback";

// Minimal localStorage so persistence (dex/memorial) round-trips under node.
class MemStore {
  m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStore }).localStorage = new MemStore();
});

describe("Run — migration spine", () => {
  it("starts at stage 0, travelling, one bonded fire, whole camp", () => {
    const r = startRun("alpha");
    expect(r.stageIndex).toBe(0);
    expect(r.phase).toBe("travel");
    expect(r.circle.length).toBe(1);
    expect(bondedCinder(r).bonded).toBe(true);
    expect(r.campIntegrity).toBe(1);
    expect(currentStage(r)).toBe(STAGES[0]);
  });

  it("difficulty rises with latitude", () => {
    const r = startRun("lat");
    expect(latitudeFactor(r)).toBe(0);
    const south = startRun("lat");
    south.stageIndex = STAGES.length - 1;
    expect(latitudeFactor(south)).toBe(1);
    expect(stageConditions(south, "water").sporeLoad).toBeGreaterThan(
      stageConditions(r, "water").sporeLoad,
    );
  });

  it("advanceTravel is deterministic and ends a travel run at encounter or camp", () => {
    const r = startRun("walk");
    let guard = 0;
    while (r.phase === "travel" && guard++ < 100) advanceTravel(r);
    expect(["encounter", "camp"]).toContain(r.phase);
    expect(r.progress).toBeLessThanOrEqual(5);

    const r2 = startRun("walk");
    let g2 = 0;
    while (r2.phase === "travel" && g2++ < 100) advanceTravel(r2);
    expect(r2.phase).toBe(r.phase); // same seed -> same trek
  });

  it("an encounter loss damages the camp; capture grows the circle; dex dedupes", () => {
    const r = startRun("enc");
    r.phase = "encounter";
    r.progress = 1;
    applyEncounterOutcome(r, {
      campDamage: 0.3,
      capturedName: "Wisp",
      dex: [{ species: "yellow-husk lark", trueClass: "mirror", firstSeenStage: currentStage(r) }],
    });
    expect(r.campIntegrity).toBeCloseTo(0.7, 5);
    expect(r.circle.length).toBe(2);
    expect(r.meta.dex.length).toBe(1);

    r.phase = "encounter";
    applyEncounterOutcome(r, {
      campDamage: 0,
      dex: [{ species: "yellow-husk lark", trueClass: "mirror", firstSeenStage: currentStage(r) }],
    });
    expect(r.meta.dex.length).toBe(1); // same species not double-listed
  });

  it("camp overrun ends the run as tribe-wiped and persists meta", () => {
    const r = startRun("wipe");
    r.meta.dex.push({ species: "foam mat", trueClass: "mirror", firstSeenStage: "Cascade Foothills" });
    r.phase = "encounter";
    r.campIntegrity = 0.2;
    applyEncounterOutcome(r, { campDamage: 0.5 });
    expect(r.outcome).toBe("tribe-wiped");
    expect(isRunOver(r)).toBe(true);
    expect(loadMeta().dex.length).toBe(1); // survived the run
  });

  it("a bonded death in camp memorialises and re-embers — the run continues", () => {
    const r = startRun("grief");
    const dying = bondedCinder(r);
    dying.vitality = 0; // already snuffed (e.g. a staked loss) — camp processes the dead
    r.phase = "camp";
    tendCamp(r);
    expect(r.meta.memorial.length).toBe(1);
    expect(r.meta.memorial[0].name).toBe(dying.name);
    expect(isRunOver(r)).toBe(false);
    expect(bondedCinder(r).bonded).toBe(true);
    expect(bondedCinder(r).name).not.toBe(dying.name);
    expect(r.stageIndex).toBe(1);
  });

  it("a circle-fire that gutters out is dropped, not memorialised", () => {
    const r = startRun("drop");
    r.phase = "encounter";
    applyEncounterOutcome(r, { campDamage: 0, capturedName: "Mote" });
    expect(r.circle.length).toBe(2);
    r.circle[1].vitality = 0; // snuffed in the field
    r.phase = "camp";
    tendCamp(r);
    expect(r.circle.length).toBe(1);
    expect(r.meta.memorial.length).toBe(0);
  });

  it("camp rest restores living fires partially — battle wear stacks across legs (DESIGN.md §8)", () => {
    const r = startRun("rest");
    r.phase = "encounter";
    applyEncounterOutcome(r, { campDamage: 0, capturedName: "Mote" });
    const bonded = bondedCinder(r);
    bonded.vitality = 0.3; // worn down in battles
    bonded.coherenceFrac = 0.2; // battered in fights
    const brimming = r.circle[1];
    brimming.vitality = 0.9; // nearly full — must clamp, never exceed 1
    brimming.coherenceFrac = 0; // benched at 0
    r.phase = "camp";
    tendCamp(r);
    expect(bondedCinder(r).name).toBe(bonded.name); // survived (not memorialised)
    expect(bondedCinder(r).vitality).toBeGreaterThan(0.3); // recovered (partial)
    expect(bondedCinder(r).vitality).toBeLessThanOrEqual(1);
    // Coherence is now PARTIAL — only the Hearth's deep tend fully heals.
    expect(bondedCinder(r).coherenceFrac).toBeGreaterThan(0.2);
    expect(bondedCinder(r).coherenceFrac).toBeLessThan(1);
    expect(brimming.vitality).toBeGreaterThan(0.9);
    expect(brimming.vitality).toBeLessThanOrEqual(1); // clamped
    // A benched fire (coherenceFrac=0) becomes usable but still wounded.
    expect(brimming.coherenceFrac).toBeGreaterThan(0);
    expect(brimming.coherenceFrac).toBeLessThan(1);
  });

  it("stage modifiers thread into tendFires: Sierra Madre rest is weaker than Cascade rest", () => {
    // Same fire, same starting wear — but tended at two different stages.
    // The northern stage uses the default modifier (1.0); Sierra Madre's
    // long winter halves what camp restores (DESIGN.md §5).
    const north = startRun("stage-north");
    north.stageIndex = 0; // Cascade Foothills — default modifier
    north.circle[0].coherenceFrac = 0.2;
    north.circle[0].vitality = 0.2;
    tendFires(north);
    const sierra = startRun("stage-sierra");
    sierra.stageIndex = 4; // Sierra Madre Camps — restGainMul 0.5
    sierra.circle[0].coherenceFrac = 0.2;
    sierra.circle[0].vitality = 0.2;
    tendFires(sierra);
    expect(sierra.circle[0].coherenceFrac).toBeGreaterThan(0.2);
    expect(north.circle[0].coherenceFrac).toBeGreaterThan(sierra.circle[0].coherenceFrac);
    expect(north.circle[0].vitality).toBeGreaterThan(sierra.circle[0].vitality);
  });

  it("tendFires alone (App.legDone's call) rests the Circle without advancing the stage", () => {
    const r = startRun("legdone");
    r.stageIndex = 3; // App owns stage via setStage(node) — must NOT change here
    const bonded = bondedCinder(r);
    bonded.vitality = 0.25;
    bonded.coherenceFrac = 0; // benched in the leg
    tendFires(r); // exactly what App.legDone does on return to camp
    expect(bondedCinder(r).name).toBe(bonded.name); // survived (not memorialised)
    expect(bondedCinder(r).vitality).toBeGreaterThan(0.25); // recovered (partial)
    // Coherence recovers too, but only partially — battle wear now stacks
    // across legs (DESIGN.md §8 revision). The Hearth's deep-tend fully heals.
    expect(bondedCinder(r).coherenceFrac).toBeGreaterThan(0);
    expect(bondedCinder(r).coherenceFrac).toBeLessThan(1);
    expect(r.stageIndex).toBe(3); // tendFires must not touch progression
  });

  it("completing the last stage ends the run as arrived", () => {
    const r = startRun("arrive");
    r.stageIndex = STAGES.length - 1;
    r.phase = "camp";
    tendCamp(r);
    expect(r.outcome).toBe("arrived");
    expect(isRunOver(r)).toBe(true);
  });

  it("dex/memorial survive across runs via persistence", () => {
    const r1 = startRun("legacy");
    r1.meta.dex.push({ species: "wrong-handed fern", trueClass: "mirror", firstSeenStage: "x" });
    persistMeta(r1);
    const r2 = startRun("legacy-2");
    expect(r2.meta.dex.some((d) => d.species === "wrong-handed fern")).toBe(true);
  });

  it("flashbacks are recovered into the memorial gallery (deduped, no run, survive runs)", () => {
    expect(FLASHBACKS.length).toBeGreaterThanOrEqual(2);
    const a = FLASHBACKS[0].id;
    const b = FLASHBACKS[1].id;
    // Collected with NO RunState (the Initiation runs before a run exists).
    collectMemory(a);
    collectMemory(a); // deduped
    collectMemory(b);
    const m = loadMeta();
    expect(m.memories).toEqual([a, b]);
    expect(hasMemory(m, a)).toBe(true);
    expect(hasMemory(m, "never-seen")).toBe(false);
    // A run started afterward carries them, and persisting keeps them.
    const r = startRun("rememberer");
    expect(r.meta.memories).toEqual([a, b]);
    persistMeta(r);
    expect(loadMeta().memories).toEqual([a, b]);
  });

  it("recoverMemoryInRun updates this run's gallery, persists, and dedupes", () => {
    const r = startRun("ruiner");
    expect(unrecoveredFlashbacks(r.meta.memories).length).toBe(FLASHBACKS.length);
    const id = unrecoveredFlashbacks(r.meta.memories)[0].id;
    expect(recoverMemoryInRun(r, id)).toBe(true);
    expect(hasMemory(r.meta, id)).toBe(true);
    expect(recoverMemoryInRun(r, id)).toBe(false); // already recovered
    expect(unrecoveredFlashbacks(r.meta.memories).length).toBe(FLASHBACKS.length - 1);
    expect(loadMeta().memories).toContain(id); // persisted immediately
  });

  it("loadMeta tolerates a save with no memories field", () => {
    (globalThis as unknown as { localStorage: MemStore }).localStorage.setItem(
      "meta",
      JSON.stringify({ dex: [], memorial: [], caught: [] }),
    );
    expect(loadMeta().memories).toEqual([]);
  });

  it("caught wild fires are recorded (deduped, with stage) and survive runs", () => {
    const r = startRun("catcher");
    r.phase = "encounter";
    applyEncounterOutcome(r, { campDamage: 0, capturedName: "Wisp" });
    r.phase = "encounter";
    applyEncounterOutcome(r, { campDamage: 0, capturedName: "Wisp" }); // same fire again
    expect(r.meta.caught.length).toBe(1);
    expect(r.meta.caught[0].name).toBe("Wisp");
    expect(r.meta.caught[0].stage).toBe(currentStage(r));

    persistMeta(r);
    expect(loadMeta().caught.some((c) => c.name === "Wisp")).toBe(true);
  });

  it("recruits caught fires into the circle and releases non-bonded ones", () => {
    const r = startRun("roster");
    const bonded = bondedCinder(r).name;
    expect(r.circle.length).toBe(1);

    // Can't recruit a fire that isn't in the caught stable.
    expect(recruitFromCaught(r, "Ghost")).toBe(false);

    r.meta.caught.push({ name: "Wisp", stage: "Cascade Foothills" });
    expect(recruitFromCaught(r, "Wisp")).toBe(true);
    expect(inCircle(r, "Wisp")).toBe(true);
    expect(r.circle.length).toBe(2);
    expect(recruitFromCaught(r, "Wisp")).toBe(false); // already fielded

    // Release drops the recruit but never the bonded fire at index 0.
    expect(releaseFromCircle(r, bonded)).toBe(false);
    expect(releaseFromCircle(r, "Wisp")).toBe(true);
    expect(inCircle(r, "Wisp")).toBe(false);
    expect(r.circle.length).toBe(1);
    expect(bondedCinder(r).name).toBe(bonded);
  });
});
