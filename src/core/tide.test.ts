import { describe, it, expect, beforeEach } from "vitest";
import { startRun } from "./run";
import { makeEncounter, current, readCurrent, decide, tideOutcome } from "./tide";
import { bondedCinder } from "./run";

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

// Find a run whose encounter has the wanted truth (encounters are 1 creature).
function encounterOf(truth: "mirror" | "native" | "inert") {
  for (let i = 0; i < 200; i++) {
    const run = startRun("enc-" + truth + "-" + i);
    const t = makeEncounter(run);
    if (current(t)!._truth === truth) return { run, t };
  }
  throw new Error("no " + truth + " encounter found");
}

describe("Encounter (single wild creature, no tide wave)", () => {
  it("is exactly one creature, deterministic per run", () => {
    const a = makeEncounter(startRun("e1"));
    const b = makeEncounter(startRun("e1"));
    expect(a.entities.length).toBe(1);
    expect(a.entities[0]).toEqual(b.entities[0]);
    expect(a.finished).toBe(false);
  });

  it("reading feeds the fire, returns a band, and retest joins fires", () => {
    const run = startRun("e-read");
    const t = makeEncounter(run);
    const fire = bondedCinder(run);
    const v0 = fire.vitality;
    const band = readCurrent(t, run, fire);
    expect(typeof band).toBe("string");
    expect(fire.vitality).toBeGreaterThan(v0);
    expect(t._fires.length).toBe(1);
    readCurrent(t, run, fire); // retest -> joint Reading
    expect(t._fires.length).toBe(2);
  });

  it("handling it correctly catalogues it, costs no camp, and ends it", () => {
    const { run, t } = encounterOf("mirror");
    readCurrent(t, run, bondedCinder(run));
    decide(t, run, "burn"); // mirror -> burn is correct
    expect(t.finished).toBe(true);
    expect(t.campDamage).toBe(0);
    const out = tideOutcome(t);
    expect(out.dex && out.dex.length).toBe(1);
  });

  it("passing a mirror creature damages the camp and dims the fire", () => {
    const { run, t } = encounterOf("mirror");
    const fire = bondedCinder(run);
    readCurrent(t, run, fire);
    const v = fire.vitality;
    decide(t, run, "pass"); // wrong: ate poison
    expect(t.campDamage).toBeGreaterThan(0);
    expect(fire.vitality).toBeLessThan(v); // expelNoise
    expect(t.finished).toBe(true);
  });

  it("decide resolves the lone entity and finishes the encounter", () => {
    const run = startRun("e-adv");
    const t = makeEncounter(run);
    readCurrent(t, run, bondedCinder(run));
    expect(t.reads.length).toBe(1);
    decide(t, run, "quarantine");
    expect(t.index).toBe(1);
    expect(t.finished).toBe(true);
    expect(t.reads.length).toBe(0);
    expect(t._fires.length).toBe(0);
  });
});
