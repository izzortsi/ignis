import { describe, it, expect } from "vitest";
import { BESTIARY } from "./bestiary";
import { critterSprite, CRITTER_COLOR, CW, CH } from "./critterart";

describe("critterart", () => {
  it("the bestiary has 20 species", () => {
    expect(BESTIARY.length).toBe(20);
  });

  it("every sprite is exactly CH rows of CW chars", () => {
    for (const s of BESTIARY) {
      const art = critterSprite(s);
      expect(art.length).toBe(CH);
      for (const r of art) expect(r.length).toBe(CW);
    }
  });

  it("is deterministic per species id and varies across species", () => {
    const a = critterSprite(BESTIARY[0]);
    const b = critterSprite(BESTIARY[0]);
    expect(a).toEqual(b);
    const sigs = new Set(BESTIARY.map((s) => critterSprite(s).join("\n")));
    expect(sigs.size).toBeGreaterThan(10);
  });

  it("classes are visually distinct (mirror vs native vs inert)", () => {
    const byClass = (c: "mirror" | "native" | "inert") =>
      critterSprite(BESTIARY.find((s) => s.trueClass === c)!).join("\n");
    expect(byClass("mirror")).not.toEqual(byClass("native"));
    expect(byClass("native")).not.toEqual(byClass("inert"));
    expect(CRITTER_COLOR.mirror).not.toEqual(CRITTER_COLOR.native);
  });
});
