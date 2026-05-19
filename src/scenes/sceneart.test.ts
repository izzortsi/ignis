import { describe, it, expect } from "vitest";
import { RIO_MIYAKE, MIRROR_LEAK, fitArt } from "./sceneart";

describe("scene-art (verbatim ludus-ignis flashbacks)", () => {
  it("RIO_MIYAKE is a rectangular pure-ASCII block", () => {
    expect(RIO_MIYAKE.length).toBeGreaterThan(80);
    for (const line of RIO_MIYAKE) {
      expect(line.length).toBe(115); // padEnd(115) from the source
      for (let i = 0; i < line.length; i++) expect(line.charCodeAt(i)).toBeLessThan(128);
    }
  });

  it("MIRROR_LEAK is a rectangular pure-ASCII block", () => {
    expect(MIRROR_LEAK.length).toBeGreaterThan(80);
    for (const line of MIRROR_LEAK) {
      expect(line.length).toBe(113);
      for (let i = 0; i < line.length; i++) expect(line.charCodeAt(i)).toBeLessThan(128);
    }
  });

  it("both are dense (many density levels, not blank)", () => {
    const variety = (a: string[]) => new Set(a.join("").split("")).size;
    expect(variety(RIO_MIYAKE)).toBeGreaterThan(5);
    expect(variety(MIRROR_LEAK)).toBeGreaterThan(5);
  });

  it("fitArt scales within bounds, stays rectangular, deterministic", () => {
    const a = fitArt(RIO_MIYAKE, 80, 20);
    const b = fitArt(RIO_MIYAKE, 80, 20);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(20);
    const w = a[0].length;
    for (const line of a) {
      expect(line.length).toBe(w);
      expect(w).toBeLessThanOrEqual(80);
    }
  });

  it("fitArt never upscales past the source", () => {
    const small = fitArt(MIRROR_LEAK, 999, 999);
    expect(small.length).toBeLessThanOrEqual(MIRROR_LEAK.length);
  });
});
