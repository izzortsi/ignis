import { describe, it, expect, beforeEach } from "vitest";
import {
  startRun,
  bondedCinder,
  applyEncounterOutcome,
  recruitFromCaught,
  type RunState,
} from "./run";
import { makeRoute } from "./routemap";
import { kindle } from "./cinder";
import {
  makeBattle,
  startBattle,
  step,
  finalizeBattle,
  learnableMoves,
  defaultLoadout,
  maxCoherence,
  power,
  initiative,
  resilience,
  miscalibration,
  wheelMul,
  MOVE_POOL,
  statProfile,
  canAfford,
  teachableMoves,
  teachSkill,
  teachCost,
  canTeach,
  knownLoadout,
  type BattleState,
  type Action,
} from "./battle";

class MemStore {
  m = new Map<string, string>();
  get length(): number { return this.m.size; }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
}
beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStore }).localStorage = new MemStore();
});

const legNode = (name: string) => {
  const r = makeRoute(name);
  return r.nodes.find((n) => n.kind === "leg")!;
};

function playOut(s: BattleState, run: RunState, pick: Action = { type: "move", moveId: "entropic-blast" }): void {
  let guard = 0;
  while (!s.done && guard++ < 200) step(s, run, pick);
}

describe("battle engine", () => {
  it("makeBattle/startBattle are deterministic for run+node", () => {
    const a = makeBattle(startRun("bz"), legNode("bz"));
    const b = makeBattle(startRun("bz"), legNode("bz"));
    expect(a.kind).toBe(b.kind);
    expect(a.foeName).toBe(b.foeName);
    expect(a.foe.level).toBe(b.foe.level);
  });

  it("the nonce gives a fresh foe per encounter (same nonce = identical)", () => {
    const node = legNode("nonced");
    const same0 = makeBattle(startRun("nonced"), node, 0);
    const same0b = makeBattle(startRun("nonced"), node, 0);
    expect(same0b.foe.name).toBe(same0.foe.name);
    expect(same0b.kind).toBe(same0.kind);
    // Across many nonces the foe identity varies (not frozen per leg).
    const ids = new Set<string>();
    for (let n = 0; n < 12; n++) {
      const b = makeBattle(startRun("nonced"), node, n);
      ids.add(b.foe.name + "|" + b.kind + "|" + b.foe.level);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it("encounters are ALWAYS wild+catchable; duels are people you can't catch", () => {
    const node = legNode("src");
    const N = 80;
    for (let i = 0; i < N; i++) {
      const g = makeBattle(startRun("src" + i), node, 0, "grass");
      const r = makeBattle(startRun("src" + i), node, 0, "rubble");
      const d = makeBattle(startRun("src" + i), node, 0, "duel");
      // Grass & rubble: always a wild cinder, always catchable, disjoint pools.
      expect(g.kind).toBe("wild");
      expect(r.kind).toBe("wild");
      expect(g.canCapture).toBe(true);
      expect(r.canCapture).toBe(true);
      expect(g.foeName).not.toMatch(/Slag|Husk|Shard|Scoria|Grit|Dross|Clinker|rat/);
      expect(r.foeName).not.toMatch(/Wisp|Mote|Glint|Tindra|Sere|Flwe|Spit/);
      expect(g.captureName.length).toBeGreaterThan(0);
      // A duel is a person + Cinder: never wild, never catchable.
      expect(["peer", "rival"]).toContain(d.kind);
      expect(d.canCapture).toBe(false);
      expect(d.captureName).toBe("");
    }
    // Same source + seed is still deterministic.
    expect(makeBattle(startRun("det"), node, 2, "rubble").foe.name).toBe(
      makeBattle(startRun("det"), node, 2, "rubble").foe.name,
    );
    expect(makeBattle(startRun("det"), node, 2, "duel").kind).toBe(
      makeBattle(startRun("det"), node, 2, "duel").kind,
    );
  });

  it("a full battle replays identically from the same seed + actions", () => {
    const r1 = startRun("rep");
    const s1 = startBattle(r1, legNode("rep"));
    playOut(s1, r1);
    const r2 = startRun("rep");
    const s2 = startBattle(r2, legNode("rep"));
    playOut(s2, r2);
    expect(s1.result).toBe(s2.result);
    expect(s1.turn).toBe(s2.turn);
    expect(s1.log.map((e) => e.text)).toEqual(s2.log.map((e) => e.text));
    expect(s1.foe.coherence).toBe(s2.foe.coherence);
  });

  it("does not perturb run._rng (battle uses its own seeded streams)", () => {
    const a = startRun("noperturb");
    const before = a._rng._state;
    const s = startBattle(a, legNode("noperturb"));
    playOut(s, a);
    expect(a._rng._state).toBe(before);
  });

  it("a battle ends decisively (win/lose/fled/captured)", () => {
    const r = startRun("decisive");
    const s = startBattle(r, legNode("decisive"));
    playOut(s, r);
    expect(s.done).toBe(true);
    expect(["win", "lose", "fled", "captured"]).toContain(s.result);
  });

  it("stats are monotonic in the fields they derive from", () => {
    const a = kindle("StatA", true);
    const b = kindle("StatA", true);
    b.level = 8;
    expect(maxCoherence(b)).toBeGreaterThan(maxCoherence(a));
    expect(power(b)).toBeGreaterThan(power(a));
    const lo = kindle("StatA", true);
    const hi = kindle("StatA", true);
    hi.level = 10;
    expect(initiative(hi, 0)).toBeGreaterThan(initiative(lo, 0));
    // Vitality is the mana pool now — it must NOT scale the HP pool.
    const v0 = kindle("StatA", true);
    const v1 = kindle("StatA", true);
    v1.vitality = 0.1;
    expect(maxCoherence(v0)).toBe(maxCoherence(v1));
    // resilience is level-driven now (was vitality-driven).
    const lo2 = kindle("StatA", true);
    const hi2 = kindle("StatA", true);
    hi2.level = 8;
    expect(resilience(hi2)).toBeGreaterThan(resilience(lo2));
  });

  it("learnable moves gate by level/bond and defaultLoadout is deterministic ≤4", () => {
    const lo = kindle("Learn", true);
    expect(learnableMoves(lo).every((m) => m.learn.minLevel <= lo.level)).toBe(true);
    const hi = kindle("Learn", true);
    hi.level = 12;
    hi.bond = 1;
    expect(learnableMoves(hi).length).toBeGreaterThan(learnableMoves(lo).length);
    const l1 = defaultLoadout(hi);
    const again = kindle("Learn", true);
    again.level = 12;
    again.bond = 1;
    expect(defaultLoadout(again).map((m) => m.id)).toEqual(l1.map((m) => m.id)); // deterministic per name+state
    expect(l1.length).toBeLessThanOrEqual(4);
    // The two starter skills anchor every loadout (DESIGN.skills §3).
    expect(l1.some((m) => m.id === "negentropic-read")).toBe(true);
    expect(l1.some((m) => m.id === "entropic-blast")).toBe(true);
    // a bonded high fire can learn the bond-gated joint-read; a circle-fire cannot
    const circle = kindle("Learn", false);
    circle.level = 12;
    expect(learnableMoves(circle).some((m) => m.id === "joint-read")).toBe(false);
  });

  it("a fresh fire starts with EXACTLY the two starter skills", () => {
    const fresh = kindle("Newborn", true); // level 1, bond 0
    const ids = defaultLoadout(fresh).map((m) => m.id).sort();
    expect(ids).toEqual(["entropic-blast", "negentropic-read"]);
    // unbonded wilds too — every L1 fire, no legacy kit yet
    const wild = kindle("WildOne", false);
    expect(defaultLoadout(wild).map((m) => m.id).sort()).toEqual(["entropic-blast", "negentropic-read"]);
    // the legacy kit only appears once the fire has levelled
    const grown = kindle("Newborn", true);
    grown.level = 6;
    expect(defaultLoadout(grown).length).toBeGreaterThan(2);
  });

  it("capture is likelier against a weakened wild", () => {
    let weakCaught = 0;
    let fullCaught = 0;
    const N = 50;
    for (let i = 0; i < N; i++) {
      const name = "cap-" + i;
      const rw = startRun(name);
      const sw = startBattle(rw, legNode(name));
      if (!sw.setup.canCapture) continue;
      sw.foe.coherence = 1; // all but out
      step(sw, rw, { type: "catch" });
      if (sw.result === "captured") weakCaught++;

      const rf = startRun(name);
      const sf = startBattle(rf, legNode(name));
      if (!sf.setup.canCapture) continue;
      // full coherence
      step(sf, rf, { type: "catch" });
      if (sf.result === "captured") fullCaught++;
    }
    expect(weakCaught).toBeGreaterThan(fullCaught);
  });

  it("a wild can be caught only once per battle — a spent attempt does not roll again", () => {
    let tested = 0;
    for (let i = 0; i < 40; i++) {
      const name = "once-" + i;
      const r = startRun(name);
      const s = startBattle(r, legNode(name));
      if (!s.setup.canCapture) continue;
      s.foe.coherence = s.foe.maxCoherence; // full → low capture chance
      step(s, r, { type: "catch" });
      expect(s.triedCatch).toBe(true);
      if (s.result === "captured") continue; // first attempt landed; nothing to prove
      tested++;
      // Make it trivially catchable and try again — the one-attempt gate blocks it.
      s.foe.coherence = 1;
      const before = s.log.length;
      step(s, r, { type: "catch" });
      expect(s.result).not.toBe("captured");
      expect(s.log.slice(before).some((e) => e.text === "catch-ok")).toBe(false);
    }
    expect(tested).toBeGreaterThan(0);
  });

  it("a staked loss snuffs the fielded fire (bonded → memorial + re-ember)", () => {
    const run = startRun("snuff");
    const s = startBattle(run, legNode("snuff"));
    const deadName = bondedCinder(run).name;
    s.result = "lose";
    s.done = true;
    const out = finalizeBattle(s, run, true);
    expect(run.meta.memorial.length).toBe(1);
    expect(run.meta.memorial[0].name).toBe(deadName);
    expect(bondedCinder(run).name).not.toBe(deadName); // re-embered
    expect(out.campDamage).toBeGreaterThan(0);
  });

  it("a captured result yields a CapturedSnapshot for the run to kindle", () => {
    const run = startRun("gotcha");
    const s = startBattle(run, legNode("gotcha"));
    s.result = "captured";
    s.done = true;
    const out = finalizeBattle(s, run, false);
    expect(out.captured).toBeDefined();
    expect(out.captured!.name).toBe(s.setup.captureName);
    expect(out.campDamage).toBeLessThan(0.1);
    // The legacy capturedName field is no longer populated by the battle.
    expect(out.capturedName).toBeUndefined();
  });

  it("miscalibration scores calibration distance correctly", () => {
    expect(miscalibration("mirror", "touched")).toBe(0);
    expect(miscalibration("mirror", "of-our-hand")).toBe(4);
    expect(miscalibration("native", "of-our-hand")).toBe(0);
    expect(miscalibration("inert", "handless")).toBe(0);
    expect(miscalibration("inert", "touched")).toBe(4);
  });
});

describe("type wheel + experience (DESIGN.skills §2, §9)", () => {
  it("the wheel is a 4-cycle: strong ×1.2, weak ×0.83, neutral ×1.0", () => {
    // Cycle: entropy > negentropy > noise > signal > entropy.
    expect(wheelMul("entropy", "negentropy")).toBe(1.2);
    expect(wheelMul("negentropy", "noise")).toBe(1.2);
    expect(wheelMul("noise", "signal")).toBe(1.2);
    expect(wheelMul("signal", "entropy")).toBe(1.2);
    // The reverse direction is weak.
    expect(wheelMul("negentropy", "entropy")).toBe(0.83);
    expect(wheelMul("entropy", "signal")).toBe(0.83);
    // Same / non-adjacent → neutral.
    expect(wheelMul("entropy", "entropy")).toBe(1.0);
    expect(wheelMul("entropy", "noise")).toBe(1.0);
  });

  it("the two starter skills exist, typed, learnable at L1", () => {
    const nr = MOVE_POOL.find((m) => m.id === "negentropic-read")!;
    const eb = MOVE_POOL.find((m) => m.id === "entropic-blast")!;
    expect(nr.type).toBe("negentropy");
    expect(nr.power).toBe(0);
    expect(nr.status).toEqual({ cond: "entropy-vulnerable", chance: 1, target: "foe", turns: 3 });
    expect(nr.learn.minLevel).toBe(1);
    expect(eb.type).toBe("entropy");
    expect(eb.power).toBeGreaterThan(0);
    expect(eb.learn.minLevel).toBe(1);
    // Every move is typed (the wheel/label needs it).
    for (const m of MOVE_POOL) {
      expect(["entropy", "negentropy", "signal", "noise"]).toContain(m.type);
    }
  });

  it("a win grants XP to the fielded fire and a trickle to the Circle; a loss grants none", () => {
    function snap(c: { level: number; xp: number }): [number, number] {
      return [c.level, c.xp];
    }
    // Two fires in the circle so the trickle is observable.
    const r = startRun("xp");
    r.circle.push(kindle("Second", false));
    const s = startBattle(r, legNode("xp"));
    expect(s.you.length).toBe(2);
    const lead0 = snap(s.you[0].cinder);
    const ally0 = snap(s.you[1].cinder);
    s.result = "win";
    s.done = true;
    finalizeBattle(s, r, false);
    const lead1 = snap(s.you[0].cinder);
    const ally1 = snap(s.you[1].cinder);
    // Fielded fire advanced…
    expect(lead1[0] * 100 + lead1[1]).toBeGreaterThan(lead0[0] * 100 + lead0[1]);
    // …and the benched ally got a (smaller) trickle.
    expect(ally1[0] * 100 + ally1[1]).toBeGreaterThan(ally0[0] * 100 + ally0[1]);
    const leadGain = (lead1[0] - lead0[0]) * 100 + (lead1[1] - lead0[1]);
    const allyGain = (ally1[0] - ally0[0]) * 100 + (ally1[1] - ally0[1]);
    expect(leadGain).toBeGreaterThan(allyGain);

    // A loss grants nothing.
    const r2 = startRun("xp2");
    const s2 = startBattle(r2, legNode("xp2"));
    const before = snap(s2.you[0].cinder);
    s2.result = "lose";
    s2.done = true;
    finalizeBattle(s2, r2, false);
    expect(snap(s2.you[0].cinder)).toEqual(before);
  });

  it("a capture also pays the fielded fire, and the foe joins with inherited state", () => {
    const r = startRun("capxp");
    const s = startBattle(r, legNode("capxp"));
    const before = s.you[0].cinder.level * 100 + s.you[0].cinder.xp;
    s.result = "captured";
    s.done = true;
    const out = finalizeBattle(s, r, false);
    expect(out.captured?.name).toBe(s.setup.captureName);
    expect(s.you[0].cinder.level * 100 + s.you[0].cinder.xp).toBeGreaterThan(before);
  });
});

describe("skills are taught by the ancient fire, not auto-levelled (DESIGN.skills §3)", () => {
  it("a fire's battle kit is the two starters until taught — even at max level", () => {
    const fresh = kindle("Pupil", true);
    expect(knownLoadout(fresh).map((m) => m.id).sort()).toEqual(
      ["entropic-blast", "negentropic-read"],
    );
    fresh.level = 12; // levelling alone grants NOTHING now
    fresh.bond = 1;
    expect(knownLoadout(fresh).map((m) => m.id).sort()).toEqual(
      ["entropic-blast", "negentropic-read"],
    );
  });

  it("teachableMoves needs readiness; teachSkill adds it and is then in the kit", () => {
    const c = kindle("Learner", true);
    expect(teachableMoves(c)).toEqual([]); // L1: nothing eligible beyond anchors
    c.level = 4;
    c.xp = 50; // banked battle XP — teaching now spends it
    const opts = teachableMoves(c);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.some((m) => m.id === "negentropic-read" || m.id === "entropic-blast")).toBe(false);
    const id = opts[0].id;
    expect(teachSkill(c, id)).toBe(true);
    expect(c.skills).toContain(id);
    expect(knownLoadout(c).some((m) => m.id === id)).toBe(true);
    // can't teach the same skill twice, nor an anchor, nor an ineligible one
    expect(teachSkill(c, id)).toBe(false);
    expect(teachSkill(c, "entropic-blast")).toBe(false);
    expect(teachSkill(c, "press")).toBe(false); // legacy kit no longer exists
    expect(teachableMoves(c).some((m) => m.id === id)).toBe(false);
  });

  it("teaching spends banked XP and refuses when the fire hasn't enough (DESIGN.skills §9)", () => {
    const c = kindle("Frugal", true);
    c.level = 5; // ready for several skills
    const m = teachableMoves(c)[0];
    c.xp = 0;
    expect(canTeach(c, m)).toBe(false);
    expect(teachSkill(c, m.id)).toBe(false); // no XP banked → refused
    expect(c.skills).not.toContain(m.id);
    expect(c.level).toBe(5); // level is NEVER dropped
    c.xp = teachCost(m) + 3;
    expect(canTeach(c, m)).toBe(true);
    expect(teachSkill(c, m.id)).toBe(true);
    expect(c.xp).toBe(3); // only the cost spent, clamped ≥ 0
    expect(c.level).toBe(5);
    expect(c.skills).toContain(m.id);
  });

  it("knownLoadout caps at 4: the two anchors + the first taught skills", () => {
    const c = kindle("Veteran", true);
    c.level = 12;
    c.bond = 1;
    c.skills = ["maxwells-cut", "shannon-jam", "error-correct", "anneal"]; // 4 taught + 2 anchors
    const kit = knownLoadout(c);
    expect(kit.length).toBe(4);
    expect(kit.slice(0, 2).map((m) => m.id).sort()).toEqual(
      ["entropic-blast", "negentropic-read"],
    );
    expect(kit.slice(2).map((m) => m.id)).toEqual(["maxwells-cut", "shannon-jam"]); // teaching order
  });

  it("a fresh kindle knows no taught skills (ephemeral per run)", () => {
    expect(kindle("A", true).skills).toEqual([]);
    expect(kindle("B", false).skills).toEqual([]);
  });

  it("startBattle: your fire uses its taught kit; the foe stays level-derived", () => {
    const r = startRun("teach-battle");
    r.circle[0].level = 12;
    r.circle[0].skills = ["maxwells-cut"]; // taught one
    const s = startBattle(r, legNode("teach-battle"));
    const youKit = s.you[0].loadout.map((m) => m.id).sort();
    expect(youKit).toEqual(["entropic-blast", "maxwells-cut", "negentropic-read"]);
    // the foe is an NPC: its kit is whatever its level affords, not "taught".
    expect(s.foe.loadout.length).toBeGreaterThanOrEqual(2);
  });
});

describe("the §4 informational skills replace the legacy kit", () => {
  it("the legacy generic kit is gone; the designed skills are present", () => {
    const ids = MOVE_POOL.map((m) => m.id);
    for (const gone of ["press", "bank", "guard", "native-press", "mirror-press", "feint", "stoke", "keen-press", "scatter"]) {
      expect(ids).not.toContain(gone);
    }
    for (const here of [
      "negentropic-read", "entropic-blast", "maxwells-cut", "shannon-jam",
      "error-correct", "decoherence-cascade", "anneal", "negentropic-siphon",
      "compression-burst", "chirality-lock", "landauers-toll", "joint-read",
    ]) {
      expect(ids).toContain(here);
    }
  });

  it("every move is typed and carries a non-empty description", () => {
    for (const m of MOVE_POOL) {
      expect(["entropy", "negentropy", "signal", "noise"]).toContain(m.type);
      expect(m.desc.length).toBeGreaterThan(0);
    }
  });

  it("decohering bleeds the foe — coherence falls at least as fast as without it", () => {
    const rA = startRun("decoh");
    const sA = startBattle(rA, legNode("decoh"));
    playOut(sA, rA);

    const rB = startRun("decoh");
    const sB = startBattle(rB, legNode("decoh"));
    sB.foe.conds.push({ cond: "decohering", turns: 99 }); // same seed + extra bleed
    playOut(sB, rB);

    // Identical resolution rng; the only difference is the foe's DoT, so the
    // foe in B can only be worse off than in A — never better.
    expect(sB.foe.coherence).toBeLessThanOrEqual(sA.foe.coherence);
  });
});

describe("§4 skill engine-lever contract", () => {
  it("decohering bleeds the fielded fire too (symmetric DoT)", () => {
    const rA = startRun("decoh-you");
    const sA = startBattle(rA, legNode("decoh-you"));
    playOut(sA, rA);

    const rB = startRun("decoh-you");
    const sB = startBattle(rB, legNode("decoh-you"));
    sB.you[0].conds.push({ cond: "decohering", turns: 99 });
    playOut(sB, rB);

    expect(sB.you[0].coherence).toBeLessThanOrEqual(sA.you[0].coherence);
  });

  it("each designed skill carries the right engine lever", () => {
    const by = (id: string) => MOVE_POOL.find((m) => m.id === id)!;

    expect(by("negentropic-read").power).toBe(0);
    expect(by("negentropic-read").status).toMatchObject({ cond: "entropy-vulnerable", target: "foe" });

    const cut = by("maxwells-cut");
    expect(cut.pierce ?? 0).toBeGreaterThan(0);
    expect(cut.pierce!).toBeLessThan(1);

    expect(by("negentropic-siphon").siphon ?? 0).toBeGreaterThan(0);
    expect(by("compression-burst").compresses).toBe(true);

    const anneal = by("anneal");
    expect(anneal.kind).toBe("guard");
    expect(anneal.clears).toBe("decohering");
    expect(anneal.status).toMatchObject({ cond: "annealed", target: "self" });

    const ec = by("error-correct");
    expect(ec.kind).toBe("bank");
    expect(ec.costVitality).toBeGreaterThan(0.3); // mana model: recovery is a heavy draw, not free

    expect(by("decoherence-cascade").status).toMatchObject({ cond: "decohering", target: "foe" });
    expect(by("shannon-jam").status).toMatchObject({ cond: "jammed", target: "foe" });
    expect(by("chirality-lock").status).toMatchObject({ cond: "signal-locked", target: "foe" });

    const jr = by("joint-read");
    expect(jr.kind).toBe("joint");
    expect(jr.type).toBe("signal");
    expect(jr.learn.minBond ?? 0).toBeGreaterThan(0);
  });
});

describe("statProfile (felt stat-bar source — normalized, no numbers shown)", () => {
  it("yields 0..1 fractions, monotonic in their inputs", () => {
    const lo = kindle("Sp", true);
    lo.level = 1; lo.vitality = 0.3; lo.baseAcuity = 0.55;
    const hi = kindle("Sp", true);
    hi.level = 12; hi.vitality = 1; hi.baseAcuity = 0.95;
    const pl = statProfile(lo, 0.5);
    const ph = statProfile(hi, 0.5);
    for (const v of Object.values(pl)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(ph.power).toBeGreaterThan(pl.power);
    expect(ph.keenness).toBeGreaterThan(pl.keenness);
    expect(ph.initiative).toBeGreaterThan(pl.initiative);
    expect(ph.resilience).toBeGreaterThan(pl.resilience);
    expect(ph.vitality).toBeGreaterThan(pl.vitality);
    // coherence is just the passed fraction, clamped
    expect(statProfile(lo, 1.5).coherence).toBe(1);
    expect(statProfile(lo, -1).coherence).toBe(0);
    expect(statProfile(lo, 0.42).coherence).toBeCloseTo(0.42, 5);
  });
});

describe("vitality is the battle budget (the mana model — recovery is rationed)", () => {
  it("starters are free; recovery/utility cost breath (Error-Correct heaviest)", () => {
    const cost = (id: string) => MOVE_POOL.find((m) => m.id === id)!.costVitality;
    expect(cost("negentropic-read")).toBe(0);
    expect(cost("entropic-blast")).toBe(0);
    expect(cost("error-correct")).toBeGreaterThan(0.3); // can't be free anymore
    for (const id of ["maxwells-cut", "shannon-jam", "anneal", "negentropic-siphon", "landauers-toll"]) {
      expect(cost(id)).toBeGreaterThan(0);
    }
  });

  it("canAfford: free moves always; a costed move needs breath + a death-floor margin", () => {
    const r = startRun("afford");
    const c = r.circle[0];
    c.level = 5;
    c.skills = ["error-correct"];
    const s = startBattle(r, legNode("afford"));
    const me = s.you[0];
    const free = MOVE_POOL.find((m) => m.id === "entropic-blast")!;
    const heavy = MOVE_POOL.find((m) => m.id === "error-correct")!;
    me.cinder.vitality = 0.02; // nearly spent
    expect(canAfford(me, free)).toBe(true); // a free starter is always usable
    expect(canAfford(me, heavy)).toBe(false); // no breath for recovery
    me.cinder.vitality = 1;
    expect(canAfford(me, heavy)).toBe(true);
  });

  it("Error-Correct cannot be chained and never self-snuffs the fire", () => {
    const r = startRun("nochain");
    r.circle[0].level = 5;
    r.circle[0].skills = ["error-correct"];
    const s = startBattle(r, legNode("nochain"));
    const me = () => s.you[s.activeYou];
    me().coherence = 1; // hurt, so Error-Correct would heal
    const heavy = MOVE_POOL.find((m) => m.id === "error-correct")!;
    let castsThatLanded = 0;
    for (let t = 0; t < 25 && !s.done; t++) {
      const couldAfford = canAfford(me(), heavy);
      const before = me().cinder.vitality;
      step(s, r, { type: "move", moveId: "error-correct" });
      // a real Error-Correct spends a big chunk; a blocked one falls back free
      if (couldAfford && me().cinder.vitality < before) castsThatLanded++;
      expect(me().cinder.vitality).toBeGreaterThan(0); // a move NEVER kills it
    }
    // It drains its own budget, so only a few ever land — not every turn.
    expect(castsThatLanded).toBeGreaterThan(0);
    expect(castsThatLanded).toBeLessThan(8);
  });
});

describe("coherence persists run-wide (DESIGN.md §8 — fights have lasting cost)", () => {
  it("a fresh fire kindles whole; a battle starts at carried coherence", () => {
    const c = kindle("Whole", true);
    expect(c.coherenceFrac).toBe(1);
    const r = startRun("carry");
    r.circle[0].coherenceFrac = 0.5; // half-spent from earlier fights
    const s = startBattle(r, legNode("carry"));
    expect(s.you[0].coherence).toBeLessThan(s.you[0].maxCoherence);
    expect(s.you[0].coherence).toBeGreaterThan(0);
    // the foe is a fresh NPC — always at full
    expect(s.foe.coherence).toBe(s.foe.maxCoherence);
  });

  it("finalizeBattle writes the remaining coherence back to the run's fires", () => {
    const r = startRun("persist");
    const s = startBattle(r, legNode("persist"));
    s.you[0].coherence = Math.round(s.you[0].maxCoherence * 0.3); // battered
    s.result = "win";
    s.done = true;
    finalizeBattle(s, r, false);
    expect(r.circle[0].coherenceFrac).toBeLessThan(1);
    expect(r.circle[0].coherenceFrac).toBeGreaterThan(0);
    // a fresh battle for the SAME run now starts already worn (carries over)
    const s2 = startBattle(r, legNode("persist"));
    expect(s2.you[0].coherence).toBeLessThan(s2.you[0].maxCoherence);
  });

  it("a fire carried to 0 is benched; the field opens on a fire that can fight", () => {
    const r = startRun("bench");
    r.circle.push(kindle("Second", false));
    r.circle[0].coherenceFrac = 0; // bonded benched
    r.circle[1].coherenceFrac = 1;
    const s = startBattle(r, legNode("bench"));
    expect(s.you[0].down).toBe(true); // benched, can't be fielded
    expect(s.activeYou).toBe(1); // opens on the fire that can fight
    expect(s.you[1].down).toBe(false);
  });
});

describe("capture inheritance: the wild's body becomes yours (DESIGN.md §7)", () => {
  it("the captured snapshot inherits the foe's level + non-anchor skills + coherence wear", () => {
    // Force a wild battle deep south so the foe has a high level with a real
    // taught loadout — the inheritance has something to carry.
    let tested = 0;
    for (let i = 0; i < 40; i++) {
      const r = startRun("inh-" + i);
      r.stageIndex = 7;
      const s = startBattle(r, legNode("inh-" + i), 0, "grass");
      if (s.setup.kind !== "wild") continue; // grass is always wild today, but stay defensive
      // Beat the foe down so the catch lands; record the exact wear we expect.
      s.foe.coherence = Math.round(s.foe.maxCoherence * 0.3);
      const expectedLevel = s.foe.cinder.level;
      const expectedFrac = s.foe.coherence / s.foe.maxCoherence;
      const nonAnchorIds = s.foe.loadout
        .filter((m) => m.id !== "negentropic-read" && m.id !== "entropic-blast")
        .map((m) => m.id);
      s.result = "captured";
      s.done = true;
      const out = finalizeBattle(s, r, false);
      expect(out.captured).toBeDefined();
      expect(out.captured!.level).toBe(expectedLevel);
      expect(out.captured!.coherenceFrac).toBeCloseTo(expectedFrac, 3);
      // Skills are bounded by 2 (anchors occupy the other slots) and are
      // strictly non-anchor.
      expect(out.captured!.skills.length).toBeLessThanOrEqual(2);
      for (const id of out.captured!.skills) {
        expect(["negentropic-read", "entropic-blast"]).not.toContain(id);
        expect(nonAnchorIds).toContain(id);
      }
      tested++;
      if (tested >= 6) break;
    }
    expect(tested).toBeGreaterThan(0);
  });

  it("applying a snapshot kindles the fire at the inherited level with its skills", () => {
    const r = startRun("apply-rich");
    r.phase = "encounter";
    const before = r.circle.length;
    applyEncounterOutcome(r, {
      campDamage: 0,
      captured: {
        name: "Char",
        level: 7,
        skills: ["maxwells-cut", "shannon-jam"],
        coherenceFrac: 0.4,
      },
    });
    expect(r.circle.length).toBe(before + 1);
    const cap = r.circle[r.circle.length - 1];
    expect(cap.name).toBe("Char");
    expect(cap.level).toBe(7);
    expect(cap.skills).toEqual(["maxwells-cut", "shannon-jam"]);
    expect(cap.coherenceFrac).toBeCloseTo(0.4, 5);
    expect(cap.bonded).toBe(false);
    // Loadout in a fresh battle: the two starters PLUS the taught skills.
    const ids = knownLoadout(cap).map((m) => m.id).sort();
    expect(ids).toEqual(["entropic-blast", "maxwells-cut", "negentropic-read", "shannon-jam"]);
  });

  it("cross-run carryover stays minimal: meta.caught is {name, stage} only", () => {
    const r = startRun("crossrun");
    r.phase = "encounter";
    applyEncounterOutcome(r, {
      campDamage: 0,
      captured: {
        name: "Slag",
        level: 9,
        skills: ["error-correct"],
        coherenceFrac: 0.5,
      },
    });
    expect(r.meta.caught.length).toBe(1);
    expect(Object.keys(r.meta.caught[0]).sort()).toEqual(["name", "stage"]);
    expect(r.meta.caught[0].name).toBe("Slag");
    // A FRESH run that recruits from the stable kindles at L1 with no skills.
    const r2 = startRun("crossrun-next");
    r2.meta.caught = [{ name: "Slag", stage: "Cascade Foothills" }];
    expect(recruitFromCaught(r2, "Slag")).toBe(true);
    const fresh = r2.circle[r2.circle.length - 1];
    expect(fresh.name).toBe("Slag");
    expect(fresh.level).toBe(1);
    expect(fresh.skills).toEqual([]);
    expect(fresh.coherenceFrac).toBe(1);
  });

  it("the legacy capturedName path still kindles a fresh L1 fire (back-compat)", () => {
    const r = startRun("legacy-cap");
    r.phase = "encounter";
    const before = r.circle.length;
    applyEncounterOutcome(r, { campDamage: 0, capturedName: "Mote" });
    expect(r.circle.length).toBe(before + 1);
    const cap = r.circle[r.circle.length - 1];
    expect(cap.name).toBe("Mote");
    expect(cap.level).toBe(1);
    expect(cap.skills).toEqual([]);
  });
});

describe("essence absorption + win-vs-capture XP (DESIGN.md §7)", () => {
  it("a wild win can absorb a technique; capture/duel never do; win pays more XP", () => {
    let absWin = 0;
    let absCap = 0;
    let winXp = 0;
    let capXp = 0;
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const rw = startRun("absW" + i);
      rw.stageIndex = 7; // deep south → a high-level wild with real techniques
      const sw = startBattle(rw, legNode("absW" + i), 0, "grass");
      if (sw.setup.kind !== "wild") continue;
      const b0 = rw.circle[0].skills.length;
      const m0 = rw.circle[0].level * 1000 + rw.circle[0].xp;
      sw.result = "win";
      sw.done = true;
      finalizeBattle(sw, rw, false);
      if (rw.circle[0].skills.length > b0) absWin++;
      winXp += rw.circle[0].level * 1000 + rw.circle[0].xp - m0;

      const rc = startRun("absW" + i);
      rc.stageIndex = 7;
      const sc = startBattle(rc, legNode("absW" + i), 0, "grass");
      const c0 = rc.circle[0].skills.length;
      const cm0 = rc.circle[0].level * 1000 + rc.circle[0].xp;
      sc.result = "captured";
      sc.done = true;
      finalizeBattle(sc, rc, false);
      if (rc.circle[0].skills.length > c0) absCap++;
      capXp += rc.circle[0].level * 1000 + rc.circle[0].xp - cm0;
      n++;
    }
    expect(n).toBeGreaterThan(0);
    expect(absWin).toBeGreaterThan(0); // some wild wins absorb a technique
    expect(absCap).toBe(0); // capturing keeps it whole — never absorbs
    expect(winXp).toBeGreaterThan(capXp); // winning yields more xp than capturing

    // a duel win (a person, not wild) never absorbs
    let absDuel = 0;
    for (let i = 0; i < 20; i++) {
      const rd = startRun("absD" + i);
      rd.stageIndex = 7;
      const sd = startBattle(rd, legNode("absD" + i), 0, "duel");
      const b = rd.circle[0].skills.length;
      sd.result = "win";
      sd.done = true;
      finalizeBattle(sd, rd, false);
      if (rd.circle[0].skills.length > b) absDuel++;
    }
    expect(absDuel).toBe(0);
  });

  it("absorption is deterministic per battle identity", () => {
    const a = startRun("absdet");
    a.stageIndex = 7;
    const sa = startBattle(a, legNode("absdet"), 3, "grass");
    sa.result = "win";
    sa.done = true;
    finalizeBattle(sa, a, false);
    const b = startRun("absdet");
    b.stageIndex = 7;
    const sb = startBattle(b, legNode("absdet"), 3, "grass");
    sb.result = "win";
    sb.done = true;
    finalizeBattle(sb, b, false);
    expect(a.circle[0].skills).toEqual(b.circle[0].skills);
  });
});
