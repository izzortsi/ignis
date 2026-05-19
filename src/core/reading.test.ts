import { describe, it, expect } from "vitest";
import { Rng, seedFrom } from "../rng";
import {
  performReading,
  jointReading,
  bandMeaning,
  type Band,
  type FireReadProfile,
  type ReadingConditions,
} from "./reading";

const SHARP: FireReadProfile = { vitality: 1, spectral: "amber", manner: "confident", baseAcuity: 1 };
const DYING: FireReadProfile = { vitality: 0.22, spectral: "azure", manner: "cautious", baseAcuity: 0.5 };
const MID: FireReadProfile = { vitality: 0.6, spectral: "amber", manner: "confident", baseAcuity: 0.6 };

const GOOD: ReadingConditions = { sporeLoad: 0, wind: 0, night: true, sample: "water" };
const FOUL: ReadingConditions = { sporeLoad: 0.9, wind: 0.8, night: false, sample: "blood" };
const NOISY: ReadingConditions = { sporeLoad: 0.5, wind: 0.3, night: true, sample: "water" };

const nativeSide = (b: Band) => b === "of-our-hand" || b === "seems-of-our-hand";
const mirrorSide = (b: Band) => b === "touched" || b === "seems-touched";

describe("Reading engine", () => {
  it("is deterministic for identical seed + inputs", () => {
    const a = new Rng(seedFrom("read-det"));
    const b = new Rng(seedFrom("read-det"));
    const seqA: Band[] = [];
    const seqB: Band[] = [];
    for (let i = 0; i < 50; i++) seqA.push(performReading("mirror", MID, NOISY, a).band);
    for (let i = 0; i < 50; i++) seqB.push(performReading("mirror", MID, NOISY, b).band);
    expect(seqA).toEqual(seqB);
  });

  it("a sharp fire in good conditions reads native correctly and safely", () => {
    const rng = new Rng(seedFrom("sharp-native"));
    let correct = 0;
    let dangerous = 0; // native called mirror-side -> burns safe food
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const band = performReading("native", SHARP, GOOD, rng).band;
      if (nativeSide(band)) correct++;
      if (mirrorSide(band)) dangerous++;
    }
    expect(correct / n).toBeGreaterThan(0.9);
    expect(dangerous / n).toBeLessThan(0.01);
  });

  it("a dying fire in foul conditions makes deadly errors", () => {
    const rng = new Rng(seedFrom("dying-mirror"));
    let deadly = 0; // mirror called safe -> you eat poison
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const band = performReading("mirror", DYING, FOUL, rng).band;
      if (nativeSide(band)) deadly++;
    }
    // The whole point of fire vitality: a starved fire lies.
    expect(deadly / n).toBeGreaterThan(0.1);
  });

  it("joint Reading lowers the deadly-error rate vs a single fire", () => {
    const single = new Rng(seedFrom("joint-cmp"));
    const joint = new Rng(seedFrom("joint-cmp"));
    const n = 4000;
    let singleDeadly = 0;
    let jointDeadly = 0;
    for (let i = 0; i < n; i++) {
      if (nativeSide(performReading("mirror", MID, NOISY, single).band)) singleDeadly++;
    }
    for (let i = 0; i < n; i++) {
      if (nativeSide(jointReading("mirror", [MID, MID, MID], NOISY, joint).band)) jointDeadly++;
    }
    expect(jointDeadly).toBeLessThan(singleDeadly);
  });

  it("inert samples mostly read handless when the fire is sharp", () => {
    const rng = new Rng(seedFrom("inert"));
    let handless = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      if (performReading("inert", SHARP, GOOD, rng).band === "handless") handless++;
    }
    expect(handless / n).toBeGreaterThan(0.8);
  });

  it("bandMeaning covers every band", () => {
    const all: Band[] = [
      "of-our-hand",
      "seems-of-our-hand",
      "fire-hesitates",
      "seems-touched",
      "touched",
      "handless",
    ];
    for (const b of all) expect(bandMeaning(b).length).toBeGreaterThan(0);
  });
});
