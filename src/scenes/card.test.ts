import { describe, it, expect } from "vitest";
import { kindle } from "../core/cinder";
import { cinderCardLines, RARITY_COLOR } from "./card";

describe("Cinder card", () => {
  it("reports name, a valid rarity, and the stat block", () => {
    const c = kindle("Ember", true);
    const card = cinderCardLines(c);
    expect(card.name).toBe("Ember");
    expect(["common", "uncommon", "rare", "legendary"]).toContain(card.rarity);
    expect(RARITY_COLOR[card.rarity]).toBeTypeOf("number");
    const blob = card.stats.join("\n");
    expect(blob).toMatch(/stage\s*:/);
    expect(blob).toMatch(/vitality\s*:/);
    expect(blob).toMatch(/manner\s*:/);
    expect(blob).toMatch(/spectral\s*:/);
    expect(blob).toMatch(/acuity\s*:/);
  });

  it("shows bond for the bonded fire, marks circle-fires unbonded", () => {
    expect(cinderCardLines(kindle("Anchor", true)).stats.some((s) => s.startsWith("bond"))).toBe(true);
    expect(cinderCardLines(kindle("Spark", false)).stats.some((s) => s.includes("circle-fire"))).toBe(true);
  });

  it("is deterministic for a given fire name", () => {
    expect(cinderCardLines(kindle("Repeat", true))).toEqual(cinderCardLines(kindle("Repeat", true)));
  });
});
