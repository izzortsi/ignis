import { describe, it, expect } from "vitest";
import {
  emptyInventory,
  addCache,
  useCache,
  addRestorative,
  useRestorative,
  provisionsDeltaToCaches,
} from "./inventory";

describe("inventory core module", () => {
  it("emptyInventory starts at zero for all counted items", () => {
    const inv = emptyInventory();
    expect(inv.caches).toBe(0);
    expect(inv.restoratives).toBe(0);
  });

  it("addCache increments and clamps at zero", () => {
    const inv = emptyInventory();
    addCache(inv);
    expect(inv.caches).toBe(1);
    addCache(inv, 3);
    expect(inv.caches).toBe(4);
    addCache(inv, -10);
    expect(inv.caches).toBe(0);
  });

  it("useCache decrements and returns true; returns false when empty", () => {
    const inv = emptyInventory();
    expect(useCache(inv)).toBe(false);
    addCache(inv, 2);
    expect(useCache(inv)).toBe(true);
    expect(inv.caches).toBe(1);
    expect(useCache(inv)).toBe(true);
    expect(inv.caches).toBe(0);
    expect(useCache(inv)).toBe(false);
  });

  it("addRestorative and useRestorative work symmetrically", () => {
    const inv = emptyInventory();
    expect(useRestorative(inv)).toBe(false);
    addRestorative(inv, 2);
    expect(inv.restoratives).toBe(2);
    expect(useRestorative(inv)).toBe(true);
    expect(inv.restoratives).toBe(1);
    expect(useRestorative(inv)).toBe(true);
    expect(inv.restoratives).toBe(0);
    expect(useRestorative(inv)).toBe(false);
  });

  it("provisionsDeltaToCaches translates ruin-cache 0.18 → 1", () => {
    expect(provisionsDeltaToCaches(0.18)).toBe(1);
    expect(provisionsDeltaToCaches(0.36)).toBe(2);
    expect(provisionsDeltaToCaches(0)).toBe(0);
  });

  it("provisionsDeltaToCaches rounds small relic-style 0.05 to 0", () => {
    // Relic finds gave +0.05 provisions — too small to count as a cache.
    expect(provisionsDeltaToCaches(0.05)).toBe(0);
  });

  it("provisionsDeltaToCaches handles negative deltas (consumption)", () => {
    // H-point cost was -0.05; small enough to round to 0.
    expect(provisionsDeltaToCaches(-0.05)).toBe(0);
    // A bigger consumption translates to -1.
    expect(provisionsDeltaToCaches(-0.18)).toBe(-1);
  });
});
