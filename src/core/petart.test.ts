import { describe, it, expect } from "vitest";
import { Rng, seedFrom } from "../rng";
import {
  rollParts,
  render,
  partsForName,
  stageForCinder,
  moodForCinder,
  cinderFramesStable,
  canonStage,
  stageForName,
  HUE_COLOR,
  type Stage,
  type Mood,
} from "./petart";
import { kindle } from "./cinder";

const STAGES: Stage[] = ["spark", "emberling", "ember", "fire"];
const MOODS: Mood[] = ["idle", "happy", "eating", "sleeping", "dead"];

describe("petart (ported from mochi)", () => {
  it("rollParts is deterministic for a seed", () => {
    const a = rollParts(new Rng(seedFrom("p")));
    const b = rollParts(new Rng(seedFrom("p")));
    expect(a).toEqual(b);
  });

  it("partsForName is stable per name and varies across names", () => {
    expect(partsForName("Ember")).toEqual(partsForName("Ember"));
    const sigs = new Set(
      ["Ember", "Kel", "Ash", "Mira", "Wren", "Tova", "Suri"].map((n) => JSON.stringify(partsForName(n))),
    );
    expect(sigs.size).toBeGreaterThan(1);
  });

  it("rarity is always one of the four; every hue has a colour", () => {
    for (let i = 0; i < 200; i++) {
      const p = rollParts(new Rng(seedFrom("r" + i)));
      expect(["common", "uncommon", "rare", "legendary"]).toContain(p.rarity);
      expect(HUE_COLOR[p.hue]).toBeTypeOf("number");
    }
  });

  it("every stage/mood frame is exactly 12 rows of 20 chars", () => {
    for (const stage of STAGES) {
      const art = render(stage, partsForName("Frame-" + stage));
      const COUNT: Record<Mood, number> = { idle: 6, happy: 6, eating: 4, sleeping: 2, dead: 3 };
      for (const mood of MOODS) {
        const frames = art[mood];
        expect(frames.length).toBe(COUNT[mood]);
        for (const f of frames) {
          expect(f.length).toBe(12);
          for (const row of f) expect(row.length).toBe(20);
        }
      }
    }
  });

  it("dead mood is the smoke-over-embers frame for every stage", () => {
    for (const stage of STAGES) {
      const art = render(stage, partsForName("Dead-" + stage));
      const joined = art.dead[0].join("\n");
      expect(joined).toContain("====="); // charred base
    }
  });

  it("render is deterministic", () => {
    const p = partsForName("Det");
    expect(render("ember", p)).toEqual(render("ember", p));
  });

  it("stageForCinder grows the bonded fire and keeps circle-fires small", () => {
    const fresh = kindle("Anchor", true);
    expect(stageForCinder(fresh)).toBe("spark");
    fresh.bond = 0.6;
    expect(stageForCinder(fresh)).toBe("ember");
    fresh.bond = 1;
    expect(stageForCinder(fresh)).toBe("fire");

    const circle = kindle("Spark", false);
    circle.bond = 1; // ignored for unbonded
    expect(["spark", "emberling"]).toContain(stageForCinder(circle));
  });

  it("the bonded fire starts as an emberling and never morphs from state", () => {
    const a = kindle("Same", true);
    expect(canonStage(a)).toBe("emberling");
    const baseline = cinderFramesStable(a);
    expect(cinderFramesStable(a)).toEqual(baseline); // stable per call
    // mutate every field the old stage/mood logic keyed off — art must not move
    a.bond = 1;
    a.vitality = 0.05;
    a.streak = 9; // drives isBurnBright — old logic would have flipped mood
    expect(canonStage(a)).toBe("emberling");
    expect(cinderFramesStable(a)).toEqual(baseline);
    expect(cinderFramesStable(a)).toEqual(render("emberling", partsForName("Same")).idle);
    // only difference allowed: a snuffed fire shows the smoke frame
    const dead = kindle("Same", true);
    dead.vitality = 0;
    expect(cinderFramesStable(dead)).toEqual(render("emberling", partsForName("Same")).dead);
    expect(cinderFramesStable(dead)).not.toEqual(baseline);
  });

  it("non-bonded fires take a STABLE name-seeded stage spanning the full range", () => {
    // Stable per name & invariant under volatile state (no mid-fight morph).
    const w = kindle("Wildy", false);
    const st = stageForName("Wildy");
    expect(canonStage(w)).toBe(st);
    const base = cinderFramesStable(w);
    w.vitality = 0.02;
    w.bond = 1;
    w.streak = 9;
    expect(canonStage(w)).toBe(st);
    expect(cinderFramesStable(w)).toEqual(base);
    expect(cinderFramesStable(w)).toEqual(render(st, partsForName("Wildy")).idle);
    // Across many names the tier varies and the full spark→fire range appears.
    const seen = new Set<Stage>();
    for (let i = 0; i < 200; i++) seen.add(stageForName("foe-" + i));
    expect(seen.size).toBe(4); // spark, emberling, ember, fire all occur
    for (const s of seen) expect(STAGES).toContain(s);
  });

  it("moodForCinder reflects life state", () => {
    const c = kindle("Mood", true);
    expect(moodForCinder(c)).toBe("idle");
    c.streak = 5;
    expect(moodForCinder(c)).toBe("happy");
    c.streak = 0;
    c.vitality = 0.1;
    expect(moodForCinder(c)).toBe("sleeping");
    c.vitality = 0;
    expect(moodForCinder(c)).toBe("dead");
  });
});
