import { describe, it, expect } from "vitest";
import {
  kindle,
  feedReading,
  expelNoise,
  endPeriod,
  rememberMoment,
  readProfile,
  isAlive,
  isBurnBright,
} from "./cinder";

describe("Cinder — the Circle", () => {
  it("kindles deterministic traits from the name", () => {
    const a = kindle("Brasa", true);
    const b = kindle("Brasa", true);
    expect(a.spectral).toBe(b.spectral);
    expect(a.manner).toBe(b.manner);
    expect(a.baseAcuity).toBe(b.baseAcuity);
  });

  it("varies traits across names", () => {
    const names = ["Brasa", "Cinza", "Faisca", "Ember", "Wren", "Tova", "Suri", "Kel"];
    const sigs = new Set(names.map((n) => {
      const c = kindle(n, false);
      return `${c.spectral}|${c.manner}|${c.baseAcuity.toFixed(3)}`;
    }));
    expect(sigs.size).toBeGreaterThan(1);
  });

  it("feeding raises vitality and caps at 1", () => {
    const c = kindle("Feed", false);
    const v0 = c.vitality;
    feedReading(c);
    expect(c.vitality).toBeGreaterThan(v0);
    for (let i = 0; i < 50; i++) feedReading(c);
    expect(c.vitality).toBeLessThanOrEqual(1);
    expect(c.vitality).toBeGreaterThan(0.9);
  });

  it("a neglected period decays hard and breaks the streak", () => {
    const c = kindle("Neglect", false);
    feedReading(c);
    endPeriod(c); // fed period: streak 1
    expect(c.streak).toBe(1);
    endPeriod(c); // neglected period
    expect(c.streak).toBe(0);
    expect(c.vitality).toBeLessThan(0.7);
  });

  it("sustained neglect kills the fire and it cannot be fed again", () => {
    const c = kindle("Doused", false);
    for (let i = 0; i < 8; i++) endPeriod(c);
    expect(isAlive(c)).toBe(false);
    expect(c.vitality).toBe(0);
    const dead = c.vitality;
    feedReading(c);
    expect(c.vitality).toBe(dead); // dead fires take no food
  });

  it("contradicted calls dim faster than feeding sustains", () => {
    const fed = kindle("Steady", false);
    const erring = kindle("Erring", false);
    for (let i = 0; i < 10; i++) {
      feedReading(fed);
      feedReading(erring);
      expelNoise(erring);
      expelNoise(erring);
    }
    expect(erring.vitality).toBeLessThan(fed.vitality);
  });

  it("reaches burn-bright after sustained feeding and reads sharper", () => {
    const c = kindle("Bright", true);
    const before = readProfile(c).baseAcuity;
    for (let i = 0; i < 3; i++) {
      feedReading(c);
      endPeriod(c);
    }
    expect(isBurnBright(c)).toBe(true);
    expect(readProfile(c).baseAcuity).toBeGreaterThan(before);
  });

  it("only the bonded fire accrues bond and memory", () => {
    const bonded = kindle("Anchor", true);
    const circle = kindle("Spark", false);
    rememberMoment(bonded, "the night the tide turned");
    rememberMoment(circle, "the night the tide turned");
    expect(bonded.bond).toBeGreaterThan(0);
    expect(bonded.memory.length).toBe(1);
    expect(circle.bond).toBe(0);
    expect(circle.memory.length).toBe(0);
  });

  it("readProfile clamps and passes traits through", () => {
    const c = kindle("Profile", false);
    const p = readProfile(c);
    expect(p.spectral).toBe(c.spectral);
    expect(p.manner).toBe(c.manner);
    expect(p.baseAcuity).toBeLessThanOrEqual(1);
    expect(p.vitality).toBe(c.vitality);
  });

  it("a Reading feeds the fire but no longer grants XP (battle-only, DESIGN.skills §9)", () => {
    const c = kindle("NoXp", false);
    const lvl0 = c.level;
    const xp0 = c.xp;
    for (let i = 0; i < 20; i++) feedReading(c);
    expect(c.level).toBe(lvl0);
    expect(c.xp).toBe(xp0);
    expect(c.vitality).toBeGreaterThan(0); // still fed
  });
});
