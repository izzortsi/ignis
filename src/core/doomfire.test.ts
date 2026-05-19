import { describe, it, expect } from "vitest";
import { Rng, seedFrom } from "../rng";
import {
  makeDoomFire,
  stepDoomFire,
  setSource,
  setSourceBand,
  intensityAt,
  fireGlyph,
  fireColor,
  FIRE_MAX,
} from "./doomfire";

describe("Doom fire", () => {
  it("seeds a max-intensity source row, cold elsewhere", () => {
    const f = makeDoomFire(20, 10);
    for (let x = 0; x < f.w; x++) {
      expect(intensityAt(f, x, f.h - 1)).toBe(FIRE_MAX);
      expect(intensityAt(f, x, 0)).toBe(0);
    }
  });

  it("rises: after enough ticks upper rows are no longer all cold", () => {
    const f = makeDoomFire(40, 24);
    const rng = new Rng(seedFrom("fire"));
    for (let i = 0; i < 200; i++) stepDoomFire(f, rng);
    let hot = 0;
    for (let x = 0; x < f.w; x++) hot += intensityAt(f, x, f.h / 2) > 0 ? 1 : 0;
    expect(hot).toBeGreaterThan(0);
  });

  it("keeps every cell in [0, FIRE_MAX]", () => {
    const f = makeDoomFire(30, 18);
    const rng = new Rng(seedFrom("bounds"));
    for (let i = 0; i < 120; i++) stepDoomFire(f, rng);
    for (let i = 0; i < f.cells.length; i++) {
      expect(f.cells[i]).toBeGreaterThanOrEqual(0);
      expect(f.cells[i]).toBeLessThanOrEqual(FIRE_MAX);
    }
  });

  it("is deterministic for a seeded Rng", () => {
    const a = makeDoomFire(24, 14);
    const b = makeDoomFire(24, 14);
    const ra = new Rng(seedFrom("same"));
    const rb = new Rng(seedFrom("same"));
    for (let i = 0; i < 60; i++) {
      stepDoomFire(a, ra);
      stepDoomFire(b, rb);
    }
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
  });

  it("setSource dims the source row (a dying Hearth)", () => {
    const f = makeDoomFire(10, 6);
    setSource(f, 0.25);
    const lvl = intensityAt(f, 0, f.h - 1);
    expect(lvl).toBeLessThan(FIRE_MAX);
    expect(lvl).toBeGreaterThan(0);
    setSource(f, 0);
    expect(intensityAt(f, 0, f.h - 1)).toBe(0);
  });

  it("setSourceBand lights a centred band, edges cold (a plume, not a block)", () => {
    const f = makeDoomFire(20, 8);
    setSourceBand(f, 1, 0.5);
    const y = f.h - 1;
    expect(intensityAt(f, 0, y)).toBe(0); // edge cold
    expect(intensityAt(f, f.w - 1, y)).toBe(0); // edge cold
    expect(intensityAt(f, f.w >> 1, y)).toBe(FIRE_MAX); // centre burns
  });

  it("palette covers every level with ASCII glyphs and a packed color", () => {
    for (let l = 0; l <= FIRE_MAX; l++) {
      const ch = fireGlyph(l);
      expect(ch.length).toBe(1);
      expect(ch.charCodeAt(0)).toBeLessThan(128);
      const c = fireColor(l);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
    expect(fireGlyph(0)).toBe(" ");
  });
});
