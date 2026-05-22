import { describe, it, expect } from "vitest";
import { rollRuin, type RuinKind } from "./ruin";

describe("ruin mixed table", () => {
  it("is deterministic per seed", () => {
    expect(rollRuin("ruin:r:1:4:9", 2)).toEqual(rollRuin("ruin:r:1:4:9", 2));
  });

  it("different ruins differ across the run (seeded by site)", () => {
    const kinds = new Set<RuinKind>();
    for (let i = 0; i < 40; i++) kinds.add(rollRuin("ruin:run:leg:" + i + ":" + i, 2).kind);
    expect(kinds.size).toBeGreaterThan(1);
  });

  it("only ever yields the four known kinds", () => {
    for (let i = 0; i < 200; i++) {
      const k = rollRuin("k" + i, 1).kind;
      expect(["memory", "relic", "cache", "wild"]).toContain(k);
    }
  });

  it("the memory band falls back to a relic when no flashback is left", () => {
    let memWhenLeft = 0;
    let memWhenNone = 0;
    for (let i = 0; i < 300; i++) {
      if (rollRuin("seed" + i, 2).kind === "memory") memWhenLeft++;
      if (rollRuin("seed" + i, 0).kind === "memory") memWhenNone++;
    }
    expect(memWhenLeft).toBeGreaterThan(0);
    expect(memWhenNone).toBe(0); // never "memory" with nothing to recover
  });

  it("relic always names a species; cache always restocks; memory/wild do not", () => {
    for (let i = 0; i < 200; i++) {
      const roll = rollRuin("s" + i, 2);
      if (roll.kind === "relic") {
        expect(roll.relicSpecies.length).toBeGreaterThan(0);
        expect(roll.provisions).toBeGreaterThan(0);
      }
      if (roll.kind === "cache") expect(roll.provisions).toBeGreaterThan(0);
      if (roll.kind === "memory" || roll.kind === "wild") expect(roll.provisions).toBe(0);
      expect(roll.message.length).toBeGreaterThan(0);
    }
  });

  it("B2.2 fields: cache band drops 1 cache; relic band names a relic", () => {
    let cacheRolls = 0;
    let relicRolls = 0;
    for (let i = 0; i < 300; i++) {
      const roll = rollRuin("b22-" + i, 2);
      if (roll.kind === "cache") {
        cacheRolls++;
        expect(roll.caches).toBe(1);
        expect(roll.relicName).toBe("");
      }
      if (roll.kind === "relic") {
        relicRolls++;
        expect(roll.relicName.length).toBeGreaterThan(0);
        expect(roll.relicName).toBe(roll.relicSpecies); // mirrors legacy field
        expect(roll.caches).toBe(0);
      }
      if (roll.kind === "memory" || roll.kind === "wild") {
        expect(roll.caches).toBe(0);
        expect(roll.relicName).toBe("");
        expect(roll.restoratives).toBe(0);
      }
    }
    expect(cacheRolls).toBeGreaterThan(0);
    expect(relicRolls).toBeGreaterThan(0);
  });

  it("B2.2 restorative chance fires on cache/relic but not memory/wild", () => {
    let resOnCacheRelic = 0;
    let resOnMemoryWild = 0;
    for (let i = 0; i < 500; i++) {
      const roll = rollRuin("rest-" + i, 2);
      if (roll.restoratives > 0) {
        if (roll.kind === "cache" || roll.kind === "relic") resOnCacheRelic++;
        else resOnMemoryWild++;
      }
    }
    expect(resOnCacheRelic).toBeGreaterThan(0); // chance fires sometimes
    expect(resOnMemoryWild).toBe(0); // never on memory or wild
  });
});
