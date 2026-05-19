import { describe, it, expect } from "vitest";
import { Rng, seedFrom } from "../rng";
import { BESTIARY, speciesByClass, pickSpecies, speciesByName } from "./bestiary";

describe("Bestiary", () => {
  it("covers every truth class", () => {
    expect(speciesByClass("mirror").length).toBeGreaterThan(0);
    expect(speciesByClass("native").length).toBeGreaterThan(0);
    expect(speciesByClass("inert").length).toBeGreaterThan(0);
  });

  it("every entry is well-formed", () => {
    for (const s of BESTIARY) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.look.length).toBeGreaterThan(0);
      expect(s.tell.length).toBeGreaterThan(0);
      expect(["mirror", "native", "inert"]).toContain(s.trueClass);
    }
  });

  it("pickSpecies is deterministic and respects the class", () => {
    const a = new Rng(seedFrom("pick"));
    const b = new Rng(seedFrom("pick"));
    for (let i = 0; i < 20; i++) {
      const sa = pickSpecies(a, "mirror");
      const sb = pickSpecies(b, "mirror");
      expect(sa.id).toBe(sb.id);
      expect(sa.trueClass).toBe("mirror");
    }
  });

  it("speciesByName round-trips", () => {
    expect(speciesByName(BESTIARY[0].name)!.id).toBe(BESTIARY[0].id);
    expect(speciesByName("not a real thing")).toBeUndefined();
  });
});
