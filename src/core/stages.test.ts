import { describe, it, expect } from "vitest";
import { startRun, STAGES } from "./run";
import {
  modifierFor,
  modifierAt,
  stageEncounterMul,
  stageRestGainMul,
  stageFoeLevelBonus,
  stageFlavor,
} from "./stages";

describe("stage modifiers (DESIGN.md §5)", () => {
  it("modifierFor returns a default for unconfigured stages (outside the 0-7 spine)", () => {
    // All 8 spine stages are now configured; an out-of-range index falls
    // through to DEFAULT_MODIFIER.
    const m = modifierFor(99);
    expect(m.encounterMul).toBe(1.0);
    expect(m.restGainMul).toBe(1.0);
    expect(m.foeLevelBonus).toBe(0);
    expect(m.flavor).toBe("");
  });

  it("the 8 named stages each round-trip through modifierAt", () => {
    for (let i = 0; i < STAGES.length; i++) {
      const m = modifierAt(i);
      expect(m).toBeDefined();
      expect(m.encounterMul).toBeGreaterThan(0);
      expect(m.restGainMul).toBeGreaterThan(0);
    }
  });

  it("Sonoran (3) and Sierra Madre (4) dampen recovery; Sierra is most punishing", () => {
    expect(modifierFor(3).restGainMul).toBeLessThan(1);
    expect(modifierFor(4).restGainMul).toBeLessThan(1);
    expect(modifierFor(4).restGainMul).toBeLessThan(modifierFor(3).restGainMul);
  });

  it("Yucatan (5) and Isthmus (6) amplify encounters; Isthmus most", () => {
    expect(modifierFor(5).encounterMul).toBeGreaterThan(1);
    expect(modifierFor(6).encounterMul).toBeGreaterThan(1);
    expect(modifierFor(6).encounterMul).toBeGreaterThan(modifierFor(5).encounterMul);
  });

  it("foe-level bonus rises near the equator (5, 6 get +1; the Andes get +2)", () => {
    expect(modifierFor(5).foeLevelBonus).toBe(1);
    expect(modifierFor(6).foeLevelBonus).toBe(1);
    expect(modifierFor(7).foeLevelBonus).toBe(2);
    expect(modifierFor(0).foeLevelBonus).toBe(0);
    expect(modifierFor(1).foeLevelBonus).toBe(0);
  });

  it("accessors thread a RunState's stage cleanly", () => {
    const r = startRun("stage-thread");
    r.stageIndex = 4;
    expect(stageEncounterMul(r)).toBe(modifierFor(4).encounterMul);
    expect(stageRestGainMul(r)).toBe(modifierFor(4).restGainMul);
    expect(stageFoeLevelBonus(r)).toBe(modifierFor(4).foeLevelBonus);
    expect(stageFlavor(r)).toBe(modifierFor(4).flavor);
  });

  it("modifierAt clamps stages out of range to the spine bounds", () => {
    expect(modifierAt(-1)).toEqual(modifierFor(0));
    expect(modifierAt(99)).toEqual(modifierFor(STAGES.length - 1));
  });

  it("every stage carries a non-empty flavor line", () => {
    for (let i = 0; i < STAGES.length; i++) {
      expect(modifierAt(i).flavor.length).toBeGreaterThan(0);
    }
  });
});
