import { describe, it, expect } from "vitest";
import { Rng, seedFrom } from "./rng";

describe("Rng", () => {
  it("is deterministic for a fixed seed", () => {
    const a = new Rng(seedFrom("Brasa"));
    const b = new Rng(seedFrom("Brasa"));
    const seqA = Array.from({ length: 16 }, () => a.nextU64().toString());
    const seqB = Array.from({ length: 16 }, () => b.nextU64().toString());
    expect(seqA).toEqual(seqB);
  });

  it("differs across seeds", () => {
    const a = new Rng(seedFrom("Brasa"));
    const b = new Rng(seedFrom("Cinza"));
    expect(a.nextU64()).not.toEqual(b.nextU64());
  });

  it("nextFloat stays in [0, 1)", () => {
    const r = new Rng(seedFrom("range-check"));
    for (let i = 0; i < 10000; i++) {
      const f = r.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("nextInt stays in [0, bound)", () => {
    const r = new Rng(seedFrom("int-check"));
    for (let i = 0; i < 10000; i++) {
      const n = r.nextInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it("chance(0) is never true and chance(1) is always true", () => {
    const r = new Rng(seedFrom("chance-bounds"));
    for (let i = 0; i < 1000; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });

  it("chance(p) is approximately calibrated", () => {
    const r = new Rng(seedFrom("calibration"));
    let hits = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) if (r.chance(0.3)) hits++;
    expect(hits / n).toBeGreaterThan(0.28);
    expect(hits / n).toBeLessThan(0.32);
  });

  it("seedFrom is stable and non-zero", () => {
    expect(seedFrom("Brasa")).toEqual(seedFrom("Brasa"));
    expect(seedFrom("")).not.toEqual(0n);
  });
});
