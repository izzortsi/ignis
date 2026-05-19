import { describe, it, expect } from "vitest";
import {
  coherenceFelt,
  pressFelt,
  scatterFelt,
  moveFelt,
  orderFelt,
  kindleFelt,
  captureFelt,
  growthFelt,
  teachFelt,
  absorbFelt,
  tribeFelt,
  condWord,
  barFelt,
  type StatKind,
} from "./battle-felt";
import { MOVE_POOL, type Condition } from "./battle";

const NO_DIGIT = /^[^0-9]*$/;

describe("battle-felt (the no-numbers firewall)", () => {
  it("never emits a digit anywhere", () => {
    const samples: string[] = [
      ...[0, 0.1, 0.25, 0.5, 0.7, 0.9, 1].map((f) => coherenceFelt(f).word),
      ...[0.4, 0.7, 0.85, 1.0, 1.2].map(pressFelt),
      scatterFelt(true), scatterFelt(false),
      ...MOVE_POOL.flatMap((m) => [moveFelt(m).reliability, moveFelt(m).cost]),
      orderFelt("you-first"), orderFelt("foe-first"), orderFelt("cross"),
      kindleFelt(0), kindleFelt(2), kindleFelt(9),
      captureFelt(true, "Wisp"), captureFelt(false, "Wisp"),
      growthFelt("sharper", "Ash"), growthFelt("steadied", "Ash"), growthFelt("none", "Ash"),
    ];
    for (const s of samples) expect(s).toMatch(NO_DIGIT);
  });

  it("coherence cells are monotonic and bounded 0..6", () => {
    let last = -1;
    for (let f = 0; f <= 1.0001; f += 0.05) {
      const c = coherenceFelt(f);
      expect(c.cells).toBeGreaterThanOrEqual(0);
      expect(c.cells).toBeLessThanOrEqual(6);
      expect(c.cells).toBeGreaterThanOrEqual(last);
      last = c.cells;
    }
    expect(coherenceFelt(0).grave).toBe(true);
    expect(coherenceFelt(1).grave).toBe(false);
    expect(coherenceFelt(1).cells).toBe(6);
  });

  it("pressFelt orders from slides-off to bites-deep", () => {
    const order = [0.4, 0.65, 0.8, 1.0, 1.2].map(pressFelt);
    expect(new Set(order).size).toBeGreaterThan(3); // distinct bands
    expect(pressFelt(1.25)).toMatch(/deep/);
    expect(pressFelt(0.4)).toMatch(/slides off/);
  });

  it("moveFelt maps every pool move to felt reliability + cost", () => {
    for (const m of MOVE_POOL) {
      const f = moveFelt(m);
      expect(f.reliability.length).toBeGreaterThan(0);
      expect(f.cost.length).toBeGreaterThan(0);
    }
    const free = MOVE_POOL.find((m) => m.id === "entropic-blast")!;
    expect(moveFelt(free).cost).toMatch(/rests/); // a free starter (cost 0)
    const heavy = MOVE_POOL.find((m) => m.id === "error-correct")!;
    expect(moveFelt(heavy).cost).toMatch(/dearly/); // recovery now costs a lot
  });

  it("kindle ladder clamps; capture both branches", () => {
    expect(kindleFelt(-3)).toBe(kindleFelt(0));
    expect(kindleFelt(99)).toBe(kindleFelt(2));
    expect(captureFelt(true, "Mote")).toContain("Mote");
    expect(captureFelt(false, "Mote")).toMatch(/slips back/);
  });

  it("condWord covers every Condition + the read-through states", () => {
    const conds: Condition[] = ["rattled", "dazzled", "spore-fouled", "stoked", "banked"];
    for (const c of conds) expect(condWord(c).length).toBeGreaterThan(0);
    expect(condWord("guttering")).toBe("guttering");
    expect(condWord("starved")).toBe("starved");
    expect(condWord("burn-bright")).toBe("burn-bright");
  });

  it("growthFelt none is empty, others name the fire", () => {
    expect(growthFelt("none", "Ash")).toBe("");
    expect(growthFelt("sharper", "Ash")).toContain("Ash");
    expect(growthFelt("steadied", "Ash")).toContain("Ash");
  });

  it("teachFelt is felt-only and never a number", () => {
    expect(teachFelt(true, true)).not.toMatch(/[0-9%]/);
    expect(teachFelt(false, true)).not.toMatch(/[0-9%]/);
    expect(teachFelt(false, false)).toBe("not ready for this yet");
    expect(teachFelt(true, true)).not.toBe(teachFelt(false, true));
  });

  it("absorbFelt names the fire and stays felt-only", () => {
    expect(absorbFelt("Ash")).toContain("Ash");
    expect(absorbFelt("Ash")).not.toMatch(/[0-9%]/);
  });

  it("tribeFelt: felt bands, low flag near the wipe, clamps", () => {
    expect(tribeFelt(1).low).toBe(false);
    expect(tribeFelt(1).word).not.toMatch(/[0-9%]/);
    expect(tribeFelt(0).low).toBe(true); // broken → warn
    expect(tribeFelt(0.1).low).toBe(true); // near the wipe → warn
    expect(tribeFelt(0.7).low).toBe(false); // healthy → no warn
    expect(tribeFelt(2).word).toBe(tribeFelt(1).word); // clamps high
    expect(tribeFelt(-1).low).toBe(true); // clamps low
    expect(tribeFelt(1).word).not.toBe(tribeFelt(0).word); // distinct bands
  });
});

describe("felt stat bars (no numbers — discrete bands)", () => {
  const KINDS: StatKind[] = ["vitality", "power", "keenness", "resilience", "initiative"];

  it("barFelt: 1..6 cells, a non-empty word, monotonic in frac, no number leaks", () => {
    for (const k of KINDS) {
      const lo = barFelt(0, k);
      const mid = barFelt(0.5, k);
      const hi = barFelt(1, k);
      expect(lo.cells).toBe(1);
      expect(hi.cells).toBe(6);
      expect(mid.cells).toBeGreaterThanOrEqual(lo.cells);
      expect(hi.cells).toBeGreaterThanOrEqual(mid.cells);
      for (const b of [lo, mid, hi]) {
        expect(b.word.length).toBeGreaterThan(0);
        expect(b.word).not.toMatch(/[0-9%]/); // the firewall
        expect(b.cells).toBeGreaterThanOrEqual(1);
        expect(b.cells).toBeLessThanOrEqual(6);
      }
      // distinct words across the span
      expect(lo.word).not.toBe(hi.word);
    }
    // out-of-range clamps, never throws
    expect(barFelt(-1, "power").cells).toBe(1);
    expect(barFelt(9, "power").cells).toBe(6);
  });
});
