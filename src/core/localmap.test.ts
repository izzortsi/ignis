import { describe, it, expect } from "vitest";
import {
  makeLocalMap,
  tryMove,
  tileAt,
  siteAt,
  computeVisible,
  isWalkable,
  isOpaque,
  canSeeFrom,
  stepToward,
  spawnDuelSite,
  type LocalMap,
  type Tile,
} from "./localmap";
import { makeRoute } from "./routemap";
import { Rng, seedFrom } from "../rng";

// A real interior leg node (has rank + danger).
const legNode = (name: string) => {
  const r = makeRoute(name);
  return r.nodes.find((n) => n.kind === "leg")!;
};

function reachable(m: LocalMap, tx: number, ty: number): boolean {
  const seen = new Set<number>();
  const stack: [number, number][] = [[m.px, m.py]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const k = y * m.w + x;
    if (seen.has(k)) continue;
    seen.add(k);
    if (x === tx && y === ty) return true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const t = tileAt(m, nx, ny);
      if (!isOpaque(t)) stack.push([nx, ny]);
    }
  }
  return false;
}

describe("Walkable local map", () => {
  it("is deterministic from run name + node", () => {
    const n = legNode("trek");
    const a = makeLocalMap("trek", n);
    const b = makeLocalMap("trek", n);
    expect(a.tiles).toEqual(b.tiles);
    expect([a.px, a.py]).toEqual([b.px, b.py]);
    expect(JSON.stringify(a.sites)).toEqual(JSON.stringify(b.sites));
  });

  it("is bounded by non-walkable cliff", () => {
    const m = makeLocalMap("edge", legNode("edge"));
    for (let x = 0; x < m.w; x++) {
      expect(tileAt(m, x, 0)).toBe("cliff");
      expect(tileAt(m, x, m.h - 1) === "cliff" || tileAt(m, x, m.h - 1) === "exit").toBe(true);
    }
  });

  it("entry, exit, and every encounter site are reachable", () => {
    for (const name of ["a", "b", "seed-42", "izzortsi", "longwalk"]) {
      const m = makeLocalMap(name, legNode(name));
      expect(reachable(m, m.exitX, m.exitY)).toBe(true);
      for (const s of m.sites) expect(reachable(m, s.x, s.y)).toBe(true);
    }
  });

  it("seeds several optional mixed encounters on clear floor, off entry/exit", () => {
    const m = makeLocalMap("sites", legNode("sites"));
    expect(m.sites.length).toBeGreaterThan(0);
    for (const s of m.sites) {
      expect(["tide", "duel", "forage", "ruin", "camp"]).toContain(s.kind);
      expect(s.resolved).toBe(false);
      expect(tileAt(m, s.x, s.y)).toBe("floor"); // not water/rubble/exit
      expect(s.x === m.px && s.y === m.py).toBe(false);
      expect(s.x === m.exitX && s.y === m.exitY).toBe(false);
    }
  });

  it("classifies terrain: water/rubble/sand walkable, wall/cliff/sea opaque", () => {
    expect(isWalkable("water")).toBe(true);
    expect(isWalkable("rubble")).toBe(true);
    expect(isWalkable("sand")).toBe(true);
    expect(isOpaque("wall")).toBe(true);
    expect(isOpaque("cliff")).toBe(true);
    expect(isOpaque("sea")).toBe(true);
    expect(isWalkable("sea")).toBe(false);
    expect(isWalkable("wall")).toBe(false);
  });

  it("biome reads from the node rank; coast/isthmus carry sea, desert sand", () => {
    const r = makeRoute("biomes");
    const leg = r.nodes.find((n) => n.kind === "leg")!;
    const coast = makeLocalMap("biomes", { ...leg, rank: 1 });
    const desert = makeLocalMap("biomes", { ...leg, rank: 3 });
    const isth = makeLocalMap("biomes", { ...leg, rank: 6 });
    expect(coast.tiles.includes("sea" as Tile)).toBe(true);
    expect(isth.tiles.includes("sea" as Tile)).toBe(true);
    expect(desert.tiles.includes("sand" as Tile)).toBe(true);
  });

  it("grass is walkable, not opaque, and beds appear in legs", () => {
    expect(isWalkable("grass")).toBe(true);
    expect(isOpaque("grass")).toBe(false);
    const hasGrass = ["g1", "g2", "g3", "g4"].some((s) => {
      const n = legNode(s);
      n.danger = 0.9; // a grim southern leg seeds plenty of grass
      return makeLocalMap(s, n).tiles.includes("grass" as Tile);
    });
    expect(hasGrass).toBe(true);
  });
});

describe("local map movement (synthetic)", () => {
  function mk(): LocalMap {
    // 4x3 floor; exit at (3,1); a forage site at (1,1); a wall at (1,0).
    const w = 4;
    const h = 3;
    const tiles: Tile[] = new Array(w * h).fill("floor");
    tiles[1 * w + 3] = "exit";
    tiles[0 * w + 1] = "wall";
    return {
      w,
      h,
      tiles,
      px: 0,
      py: 1,
      exitX: 3,
      exitY: 1,
      sites: [{ x: 1, y: 1, kind: "forage", resolved: false }],
    };
  }

  it("walls and cliffs block; floor moves", () => {
    const m = mk();
    m.px = 1;
    m.py = 1;
    expect(tryMove(m, 0, -1)).toBe("blocked"); // into the wall at (1,0)
    expect([m.px, m.py]).toEqual([1, 1]);
  });

  it("stepping a cell with a site moves there; siteAt finds it", () => {
    const m = mk();
    expect(tryMove(m, 1, 0)).toBe("moved"); // (0,1) -> (1,1)
    const s = siteAt(m, m.px, m.py);
    expect(s?.kind).toBe("forage");
    expect(s?.resolved).toBe(false);
    expect(siteAt(m, 3, 1)).toBeUndefined();
  });

  it("the exit is always open (no gating)", () => {
    const m = mk();
    m.px = 2;
    m.py = 1;
    expect(tryMove(m, 1, 0)).toBe("exit"); // (2,1) -> (3,1) exit, no precondition
  });
});

describe("Cinder-light field of view", () => {
  function mk(): LocalMap {
    const w = 5;
    const h = 5;
    const tiles: Tile[] = new Array(w * h).fill("floor");
    tiles[2 * w + 2] = "wall";
    return { w, h, tiles, px: 0, py: 2, exitX: 4, exitY: 0, sites: [] };
  }

  it("always sees its own cell and stays within radius", () => {
    const m = mk();
    const vis = computeVisible(m, 0, 2, 2);
    expect(vis.has(2 * 5 + 0)).toBe(true);
    for (const i of vis) {
      const x = i % 5;
      const y = (i - x) / 5;
      expect((x - 0) ** 2 + (y - 2) ** 2).toBeLessThanOrEqual(2 * 2);
    }
  });

  it("an opaque wall blocks sight beyond it", () => {
    const m = mk();
    const vis = computeVisible(m, 0, 2, 6);
    expect(vis.has(2 * 5 + 1)).toBe(true);
    expect(vis.has(2 * 5 + 2)).toBe(true); // the wall itself is seen
    expect(vis.has(2 * 5 + 3)).toBe(false); // behind it — dark
    expect(vis.has(2 * 5 + 4)).toBe(false);
  });

  it("a brighter (larger) radius reveals at least as much", () => {
    const m = mk();
    const near = computeVisible(m, 0, 2, 2);
    const far = computeVisible(m, 0, 2, 5);
    for (const i of near) expect(far.has(i)).toBe(true);
  });
});

describe("pursuit (a duelist that hunts you)", () => {
  // 7x7 open room; a wall pillar at (3,3).
  function room(): LocalMap {
    const w = 7;
    const h = 7;
    const tiles: Tile[] = new Array(w * h).fill("floor");
    tiles[3 * w + 3] = "wall";
    return { w, h, tiles, px: 0, py: 0, exitX: 6, exitY: 6, sites: [] };
  }

  it("canSeeFrom uses the player's exact FOV (radius + occlusion)", () => {
    const m = room();
    // open and within radius → seen; same as computeVisible from that cell.
    expect(canSeeFrom(m, 0, 0, 2, 0, 4)).toBe(true);
    expect(canSeeFrom(m, 0, 0, 2, 0, 4)).toBe(
      computeVisible(m, 0, 0, 4).has(0 * 7 + 2),
    );
    // beyond the radius → not seen.
    expect(canSeeFrom(m, 0, 0, 6, 6, 3)).toBe(false);
    // a bigger radius (a brighter Cinder) can reveal what a smaller one can't.
    const tooFar = canSeeFrom(m, 0, 0, 5, 0, 3);
    const nowSeen = canSeeFrom(m, 0, 0, 5, 0, 6);
    expect(tooFar).toBe(false);
    expect(nowSeen).toBe(true);
  });

  it("stepToward moves one cell along the dominant axis", () => {
    const m = room();
    expect(stepToward(m, 0, 0, 4, 1)).toEqual([1, 0]); // |dx|>|dy| → x
    expect(stepToward(m, 0, 0, 1, 4)).toEqual([0, 1]); // |dy|>|dx| → y
    expect(stepToward(m, 3, 3, 3, 3)).toEqual([3, 3]); // already there
  });

  it("stepToward routes around a wall, and stays put only when boxed in", () => {
    const m = room();
    // (2,3)→(5,5): the x step hits the wall at (3,3); falls back to the y axis.
    expect(stepToward(m, 2, 3, 5, 5)).toEqual([2, 4]);
    // Both candidate cells walled → no progress this turn (same cell).
    const boxed: LocalMap = {
      w: 3, h: 3,
      // (2,1) and (1,2) are walls — the only two steps toward (2,2).
      tiles: ["floor", "floor", "floor", "floor", "floor", "wall", "floor", "wall", "floor"],
      px: 0, py: 0, exitX: 2, exitY: 2, sites: [],
    };
    expect(stepToward(boxed, 1, 1, 2, 2)).toEqual([1, 1]);
  });

  it("from anywhere in an open room the hunter closes to adjacency", () => {
    const m = room();
    m.tiles[3 * m.w + 3] = "floor"; // clear the pillar — fully open
    let hx = 6;
    let hy = 6;
    const tx = 0;
    const ty = 0;
    let guard = 0;
    while (Math.max(Math.abs(hx - tx), Math.abs(hy - ty)) > 1 && guard++ < 50) {
      const n = stepToward(m, hx, hy, tx, ty);
      hx = n[0];
      hy = n[1];
    }
    expect(Math.max(Math.abs(hx - tx), Math.abs(hy - ty))).toBeLessThanOrEqual(1);
  });
});

describe("spawnDuelSite (mid-leg duelist appearances)", () => {
  // A 30x30 open room: cliffs around the border, floor everywhere else.
  // Plenty of valid spawn cells far from the player.
  function bigEmpty(): LocalMap {
    const w = 30;
    const h = 30;
    const tiles: Tile[] = new Array(w * h);
    for (let i = 0; i < tiles.length; i++) {
      const x = i % w;
      const y = Math.floor(i / w);
      tiles[i] = (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? "cliff" : "floor";
    }
    tiles[(h - 2) * w + (w - 2)] = "exit";
    return {
      w, h, tiles,
      px: 1, py: 1,
      exitX: w - 2, exitY: h - 2,
      sites: [],
    };
  }

  it("places a duel on a floor cell, away from the given point, unresolved", () => {
    const m = bigEmpty();
    const rng = new Rng(seedFrom("spawn-1"));
    const site = spawnDuelSite(m, rng, m.px, m.py);
    expect(site).not.toBeNull();
    expect(site!.kind).toBe("duel");
    expect(site!.resolved).toBe(false);
    expect(m.tiles[site!.y * m.w + site!.x]).toBe("floor");
    // At least SPAWN_MIN_DIST (6) Chebyshev away — off-screen at common
    // light radii so the spawn isn't visible the moment it happens.
    expect(Math.max(Math.abs(site!.x - m.px), Math.abs(site!.y - m.py))).toBeGreaterThanOrEqual(6);
    expect(m.sites).toContain(site);
  });

  it("is deterministic for a given seed + map state", () => {
    const a = bigEmpty();
    const b = bigEmpty();
    const ra = new Rng(seedFrom("spawn-det"));
    const rb = new Rng(seedFrom("spawn-det"));
    const sa = spawnDuelSite(a, ra, a.px, a.py);
    const sb = spawnDuelSite(b, rb, b.px, b.py);
    expect(sa).not.toBeNull();
    expect([sa!.x, sa!.y]).toEqual([sb!.x, sb!.y]);
  });

  it("never places two duels on the same cell", () => {
    const m = bigEmpty();
    const rng = new Rng(seedFrom("spawn-overlap"));
    for (let i = 0; i < 8; i++) spawnDuelSite(m, rng, m.px, m.py);
    const keys = new Set(m.sites.map((s) => s.y * m.w + s.x));
    expect(keys.size).toBe(m.sites.length);
  });

  it("refuses to spawn on a non-floor tile (no D in the water / grass / rubble)", () => {
    const m = bigEmpty();
    // Carpet the interior with water — only floor cell is the player's.
    for (let y = 1; y < m.h - 1; y++) {
      for (let x = 1; x < m.w - 1; x++) {
        if (x === m.px && y === m.py) continue;
        if (x === m.exitX && y === m.exitY) continue;
        m.tiles[y * m.w + x] = "water";
      }
    }
    const rng = new Rng(seedFrom("spawn-wet"));
    expect(spawnDuelSite(m, rng, m.px, m.py)).toBeNull();
  });

  it("refuses to spawn on the exit cell or an existing site", () => {
    const m = bigEmpty();
    // Drop a pre-placed site at (20, 20).
    m.sites.push({ x: 20, y: 20, kind: "forage", resolved: false });
    const rng = new Rng(seedFrom("spawn-exit"));
    // Spawn many; none should land on the exit or the pre-placed forage.
    for (let i = 0; i < 12; i++) spawnDuelSite(m, rng, m.px, m.py);
    for (const s of m.sites) {
      if (s.kind === "forage") continue; // the pre-placed one
      expect(s.x === m.exitX && s.y === m.exitY).toBe(false);
      expect(s.x === 20 && s.y === 20).toBe(false);
    }
  });

  it("returns null when no spot is far enough (a cramped 5x5 room)", () => {
    const tiles: Tile[] = new Array(25);
    for (let i = 0; i < 25; i++) {
      const x = i % 5, y = Math.floor(i / 5);
      tiles[i] = (x === 0 || y === 0 || x === 4 || y === 4) ? "cliff" : "floor";
    }
    const m: LocalMap = {
      w: 5, h: 5, tiles,
      px: 2, py: 2,
      exitX: 4, exitY: 4,
      sites: [],
    };
    const rng = new Rng(seedFrom("spawn-cramped"));
    expect(spawnDuelSite(m, rng, m.px, m.py)).toBeNull();
  });
});
