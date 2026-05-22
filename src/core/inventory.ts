// Inventory system (DESIGN.md §13.5 — meta-progression beyond dex/memorial).
// Three item categories with different lifetimes:
//
//   - Caches (supplies): generic, run-scoped, COUNTED. Used at H points to
//     restore coherence to full, OR at the Hearth as a free deep-tend.
//   - Restoratives: vitality items, run-scoped, COUNTED. Used mid-battle to
//     restore vitality to a fielded fire. (B2.2 will add sources; B2.3 the
//     mid-battle action.)
//   - Relics: lore items, PERSISTENT across runs (live in meta.relics).
//     Pure flavor — no mechanical effect. Inventory displays them by name.
//
// This module is data + helpers only. UI and consumption logic live in
// CampScene / CaveScene / BattleEncounter. The `provisions` float on
// RunState is being replaced by `inventory.caches` (an integer count).

export interface Inventory {
  caches: number;        // generic supply units (was: provisions float)
  restoratives: number;  // vitality-restoring items (added in B2.2 sources)
  // Note: relics live on RunMeta (persistent across runs), not here.
}

export function emptyInventory(): Inventory {
  return { caches: 0, restoratives: 0 };
}

// Counted-resource helpers. All clamp at >= 0.
export function addCache(inv: Inventory, n = 1): void {
  inv.caches = Math.max(0, inv.caches + n);
}

// Use a cache if available. Returns true if one was consumed.
export function useCache(inv: Inventory): boolean {
  if (inv.caches <= 0) return false;
  inv.caches -= 1;
  return true;
}

export function addRestorative(inv: Inventory, n = 1): void {
  inv.restoratives = Math.max(0, inv.restoratives + n);
}

// Use a restorative if available. Returns true if one was consumed.
export function useRestorative(inv: Inventory): boolean {
  if (inv.restoratives <= 0) return false;
  inv.restoratives -= 1;
  return true;
}

// Cache count translation from the legacy `provisions` float (0..1).
// Each 0.18 of the old float was "one cache" (cache band of ruin gave 0.18).
// Used only by applySpoils as the bridge from the old NodeSpoils.provisions
// field to the new counted inventory. B2.2 will refactor NodeSpoils to
// expose caches directly; for now this preserves backward-compat.
const PROVISIONS_PER_CACHE = 0.18;
export function provisionsDeltaToCaches(delta: number): number {
  if (delta === 0) return 0;
  // Round, not floor — a +0.18 delta becomes +1, a -0.05 becomes 0 (lost
  // to rounding, which is fine: small negative deltas were "a bit of wear"
  // not "consume a cache" in the old model).
  // `|| 0` collapses -0 to +0 — Math.round of a small negative (e.g.
  // -0.05 / 0.18 ≈ -0.27) returns -0 in JS, which `toBe(0)` rejects via
  // Object.is equality.
  return Math.round(delta / PROVISIONS_PER_CACHE) || 0;
}
