// The walkable local map (DESIGN.md map layer 2). Each leg's ground reads as
// its STAGE's biome — a coast is a coast, ruins are ruins, the desert is open
// sand — not all caves. The robust shared pipeline is unchanged: carve a floor
// mask (per biome), keep the largest connected region, place entry (north),
// exit (farthest), and scattered optional encounter sites, all reachable; you
// explore by Cinder-light (computeVisible). Deterministic from run+node.

import { Rng, seedFrom } from "../rng";
import type { MapNode } from "./routemap";

export type Tile =
  | "floor"
  | "wall"
  | "cliff"
  | "exit"
  | "water"
  | "rubble"
  | "grass"
  | "sand" // open beach / desert ground — walkable
  | "sea"; // deep water / the ocean — impassable, blocks sight

export type EncounterKind = "duel" | "forage" | "ruin" | "camp";

export interface EncounterSite {
  x: number;
  y: number;
  kind: EncounterKind;
  resolved: boolean;
}

export interface LocalMap {
  w: number;
  h: number;
  tiles: Tile[]; // row-major terrain, length w*h
  px: number;
  py: number;
  exitX: number;
  exitY: number;
  sites: EncounterSite[];
}

const NEI4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const NEI8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

function idx(w: number, x: number, y: number): number {
  return y * w + x;
}

export function tileAt(m: LocalMap, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return "cliff";
  return m.tiles[idx(m.w, x, y)];
}

export function isOpaque(t: Tile): boolean {
  return t === "wall" || t === "cliff" || t === "sea";
}
export function isWalkable(t: Tile): boolean {
  return !isOpaque(t);
}

// --- biomes ----------------------------------------------------------------

export type Biome =
  | "forest"
  | "coast"
  | "ruins"
  | "desert"
  | "mountain"
  | "jungle"
  | "isthmus"
  | "alpine";

// Stage index (node.rank, 0..7) → biome. Mirrors run.ts STAGES order:
// Cascade Foothills / N. California Coast / Central Valley Ruins / Sonoran
// Crossing / Sierra Madre Camps / Yucatan Approach / C.A. Isthmus / Eq. Andes.
const BIOMES: Biome[] = [
  "forest", "coast", "ruins", "desert", "mountain", "jungle", "isthmus", "alpine",
];
export function biomeOf(rank: number): Biome {
  const r = Math.max(0, Math.min(BIOMES.length - 1, rank));
  return BIOMES[r];
}

// --- carve helpers ---------------------------------------------------------

function blob(floor: boolean[], w: number, h: number, ccx: number, ccy: number, rw: number, rh: number, rng: Rng): void {
  for (let y = Math.max(1, ccy - rh); y < Math.min(h - 1, ccy + rh); y++) {
    for (let x = Math.max(1, ccx - rw); x < Math.min(w - 1, ccx + rw); x++) {
      const nx = (x - ccx) / Math.max(1, rw);
      const ny = (y - ccy) / Math.max(1, rh);
      const d = nx * nx + ny * ny;
      if (d < 1 || (d < 1.5 && rng.chance(0.5))) floor[idx(w, x, y)] = true;
    }
  }
}

function roomsAndTunnels(floor: boolean[], w: number, h: number, rng: Rng, roomCount: number): void {
  const centers: Array<[number, number]> = [];
  for (let i = 0; i < roomCount; i++) {
    const rw = 5 + rng.nextInt(8);
    const rh = 4 + rng.nextInt(6);
    const rx = 2 + rng.nextInt(Math.max(1, w - rw - 4));
    const ry = 2 + rng.nextInt(Math.max(1, h - rh - 4));
    const ccx = rx + (rw >> 1);
    const ccy = ry + (rh >> 1);
    blob(floor, w, h, ccx, ccy, rw >> 1, rh >> 1, rng);
    centers.push([ccx, ccy]);
  }
  const tunnel = (ax: number, ay: number, bx: number, by: number) => {
    let x = ax;
    let y = ay;
    let guard = 0;
    while ((x !== bx || y !== by) && guard++ < 400) {
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        floor[idx(w, x, y)] = true;
        if (rng.chance(0.4) && x + 1 < w - 1) floor[idx(w, x + 1, y)] = true;
      }
      if (x !== bx && (y === by || rng.chance(0.6))) x += bx > x ? 1 : -1;
      else if (y !== by) y += by > y ? 1 : -1;
    }
  };
  for (let i = 1; i < centers.length; i++) tunnel(centers[i - 1][0], centers[i - 1][1], centers[i][0], centers[i][1]);
  const extra = 1 + rng.nextInt(2);
  for (let e = 0; e < extra && centers.length > 2; e++) {
    tunnel(centers[rng.nextInt(centers.length)][0], centers[rng.nextInt(centers.length)][1],
      centers[rng.nextInt(centers.length)][0], centers[rng.nextInt(centers.length)][1]);
  }
}

// A sinuous vertical band of land (isthmus / mountain spine): floor where the
// column is within a wandering half-width of the centre line.
function band(floor: boolean[], w: number, h: number, rng: Rng, half0: number, jitter: number): void {
  let cx = Math.floor(w / 2);
  for (let y = 1; y < h - 1; y++) {
    cx += rng.nextInt(3) - 1; // wander
    cx = Math.max(half0 + 2, Math.min(w - half0 - 2, cx));
    const half = half0 + (rng.chance(jitter) ? 1 : 0);
    for (let x = cx - half; x <= cx + half; x++) {
      if (x > 0 && x < w - 1) floor[idx(w, x, y)] = true;
    }
  }
}

function carveFloor(biome: Biome, w: number, h: number, rng: Rng, lat: number): boolean[] {
  const floor = new Array<boolean>(w * h).fill(false);
  switch (biome) {
    case "forest":
      roomsAndTunnels(floor, w, h, rng, 4 + rng.nextInt(3));
      break;
    case "jungle":
      roomsAndTunnels(floor, w, h, rng, 5 + rng.nextInt(4)); // denser
      break;
    case "ruins": {
      // Open ground, then stamp building footprints back to solid.
      for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) floor[idx(w, x, y)] = true;
      const blds = 5 + rng.nextInt(5);
      for (let b = 0; b < blds; b++) {
        const bw = 4 + rng.nextInt(7);
        const bh = 3 + rng.nextInt(5);
        const bx = 3 + rng.nextInt(Math.max(1, w - bw - 6));
        const by = 3 + rng.nextInt(Math.max(1, h - bh - 6));
        for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) floor[idx(w, x, y)] = false;
      }
      break;
    }
    case "desert": {
      // One vast open expanse; a few rock voids poked out.
      blob(floor, w, h, w >> 1, h >> 1, (w >> 1) - 2, (h >> 1) - 2, rng);
      const rocks = 5 + rng.nextInt(6);
      for (let r = 0; r < rocks; r++) {
        const cx = 3 + rng.nextInt(w - 6);
        const cy = 3 + rng.nextInt(h - 6);
        const s = 1 + rng.nextInt(3);
        for (let y = cy - s; y <= cy + s; y++) for (let x = cx - s; x <= cx + s; x++)
          if (x > 0 && y > 0 && x < w - 1 && y < h - 1) floor[idx(w, x, y)] = false;
      }
      break;
    }
    case "mountain":
      // Sparse: a couple of wide winding ledges amid the drop.
      band(floor, w, h, rng, 4 + rng.nextInt(2), 0.5);
      roomsAndTunnels(floor, w, h, rng, 1 + rng.nextInt(2));
      break;
    case "isthmus":
      band(floor, w, h, rng, 6 + rng.nextInt(3), 0.4); // a neck of land, sea both sides
      break;
    case "alpine": {
      // A few plateaus strung north→south by thin necks.
      const plats = 3 + rng.nextInt(2);
      let prev: [number, number] | null = null;
      for (let p = 0; p < plats; p++) {
        const ccx = Math.floor(w * (0.25 + 0.5 * rng.nextFloat()));
        const ccy = Math.floor((h / plats) * (p + 0.5));
        blob(floor, w, h, ccx, ccy, 5 + rng.nextInt(4), 4 + rng.nextInt(3), rng);
        if (prev) {
          const start: [number, number] = prev;
          let x = start[0];
          let y = start[1];
          while (x !== ccx || y !== ccy) {
            if (x > 0 && y > 0 && x < w - 1 && y < h - 1) floor[idx(w, x, y)] = true;
            if (x !== ccx && rng.chance(0.55)) x += ccx > x ? 1 : -1;
            else if (y !== ccy) y += ccy > y ? 1 : -1;
            else if (x !== ccx) x += ccx > x ? 1 : -1;
          }
        }
        prev = [ccx, ccy];
      }
      break;
    }
    case "coast": {
      // A landmass hugging the west; the east is open ocean.
      const landMax = Math.floor(w * (0.58 + 0.08 * rng.nextFloat()));
      blob(floor, w, h, Math.floor(landMax * 0.45), h >> 1, Math.floor(landMax * 0.6), (h >> 1) - 2, rng);
      blob(floor, w, h, Math.floor(landMax * 0.35), Math.floor(h * 0.3), landMax >> 2, h >> 2, rng);
      blob(floor, w, h, Math.floor(landMax * 0.4), Math.floor(h * 0.72), landMax >> 2, h >> 2, rng);
      // a ragged shoreline finger or two
      for (let f = 0; f < 2 + rng.nextInt(2); f++) {
        let x = Math.floor(landMax * (0.7 + 0.2 * rng.nextFloat()));
        let y = 2 + rng.nextInt(h - 4);
        for (let s = 0; s < 6 + rng.nextInt(8); s++) {
          if (x > 0 && y > 0 && x < w - 1 && y < h - 1) floor[idx(w, x, y)] = true;
          x += rng.chance(0.6) ? 1 : 0;
          y += rng.nextInt(3) - 1;
        }
      }
      break;
    }
  }
  void lat;
  return floor;
}

export function makeLocalMap(runName: string, node: MapNode): LocalMap {
  const rng = new Rng(seedFrom("local:" + runName + ":" + node.id));
  const lat = Math.max(0, node.rank) / 7;
  const biome = biomeOf(node.rank);
  const w = 45 + 2 * rng.nextInt(8); // 45..59
  const h = 21 + 2 * rng.nextInt(5); // 21..29
  const minCells = Math.max(70, Math.floor(w * h * 0.16));

  let floor = new Array<boolean>(w * h).fill(false);
  let region: number[] = [];
  for (let attempt = 0; attempt < 8 && region.length < minCells; attempt++) {
    floor = carveFloor(biome, w, h, rng, lat);
    const seen = new Array<boolean>(w * h).fill(false);
    let best: number[] = [];
    for (let i = 0; i < floor.length; i++) {
      if (!floor[i] || seen[i]) continue;
      const comp: number[] = [];
      const stack = [i];
      seen[i] = true;
      while (stack.length > 0) {
        const p = stack.pop()!;
        comp.push(p);
        const cx = p % w;
        const cy = (p - cx) / w;
        for (const [dx, dy] of NEI4) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue;
          const q = idx(w, nx, ny);
          if (floor[q] && !seen[q]) {
            seen[q] = true;
            stack.push(q);
          }
        }
      }
      if (comp.length > best.length) best = comp;
    }
    region = best;
  }
  if (region.length < minCells) {
    floor = new Array<boolean>(w * h).fill(false);
    region = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      floor[idx(w, x, y)] = true;
      region.push(idx(w, x, y));
    }
  }

  const inRegion = new Set(region);
  const bfs = (src: number): number[] => {
    const dist = new Array<number>(w * h).fill(-1);
    dist[src] = 0;
    const q = [src];
    let head = 0;
    while (head < q.length) {
      const p = q[head++];
      const cx = p % w;
      const cy = (p - cx) / w;
      for (const [dx, dy] of NEI4) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nq = idx(w, nx, ny);
        if (inRegion.has(nq) && dist[nq] < 0) {
          dist[nq] = dist[p] + 1;
          q.push(nq);
        }
      }
    }
    return dist;
  };

  let entry = region[0];
  for (const c of region) {
    const cy = Math.floor(c / w);
    const ey = Math.floor(entry / w);
    if (cy < ey || (cy === ey && c % w < entry % w)) entry = c;
  }
  const dEntry = bfs(entry);
  let exit = entry;
  for (const c of region) if (dEntry[c] > dEntry[exit]) exit = c;

  // Base terrain: region = floor; interior solid touching floor = wall;
  // everything else = the drop. Border is always cliff.
  const tiles: Tile[] = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(w, x, y);
      if (inRegion.has(i)) {
        tiles[i] = "floor";
        continue;
      }
      const border = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      let touchesFloor = false;
      if (!border) {
        for (const [dx, dy] of NEI8) {
          if (inRegion.has(idx(w, x + dx, y + dy))) {
            touchesFloor = true;
            break;
          }
        }
      }
      tiles[i] = !border && touchesFloor ? "wall" : "cliff";
    }
  }

  tiles[exit] = "exit";
  tiles[entry] = "floor";

  // --- encounter sites FIRST (on plain floor), so the biome texture pass
  // below can never starve them or sit on them. ---
  const danger = node.danger ?? lat;
  const protectedCells = new Set([entry, exit]);
  const siteCount = 2 + Math.round(danger * 3) + rng.nextInt(2);
  const shuffled = region.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const t = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = t;
  }
  const ex = entry % w;
  const ey = Math.floor(entry / w);
  const xx = exit % w;
  const xy = Math.floor(exit / w);
  const MIN_SEP = 5;
  const sites: EncounterSite[] = [];
  const farEnough = (cx: number, cy: number): boolean => {
    if ((cx - ex) ** 2 + (cy - ey) ** 2 < 9) return false;
    if ((cx - xx) ** 2 + (cy - xy) ** 2 < 9) return false;
    for (const s of sites) if ((cx - s.x) ** 2 + (cy - s.y) ** 2 < MIN_SEP * MIN_SEP) return false;
    return true;
  };
  const pickKind = (): EncounterKind => {
    const r = rng.nextFloat();
    const duelT = 0.22 + 0.18 * lat;
    if (r < 0.26) return "forage";
    if (r < 0.46) return "camp";
    if (r < 0.46 + (1 - duelT) * 0.5) return "ruin";
    return "duel";
  };
  for (const c of shuffled) {
    if (sites.length >= siteCount) break;
    if (tiles[c] !== "floor") continue;
    const cx = c % w;
    const cy = Math.floor(c / w);
    if (!farEnough(cx, cy)) continue;
    sites.push({ x: cx, y: cy, kind: pickKind(), resolved: false });
  }
  for (const s of sites) protectedCells.add(idx(w, s.x, s.y));

  // --- biome texture pass (never touches protected cells or the border) ---
  const isBorder = (i: number) => {
    const x = i % w;
    const y = (i - x) / w;
    return x === 0 || y === 0 || x === w - 1 || y === h - 1;
  };
  const scatter = (kind: Tile, count: number) => {
    for (let n = 0; n < count; n++) {
      const c = region[rng.nextInt(region.length)];
      if (protectedCells.has(c) || tiles[c] !== "floor") continue;
      tiles[c] = kind;
    }
  };
  const clumps = (kind: Tile, n: number, size: number) => {
    for (let k = 0; k < n; k++) {
      let c = region[rng.nextInt(region.length)];
      for (let s = 0; s < size; s++) {
        if (!protectedCells.has(c) && tiles[c] === "floor") tiles[c] = kind;
        const cx = c % w;
        const cy = Math.floor(c / w);
        const [dx, dy] = NEI4[rng.nextInt(4)];
        const nc = idx(w, cx + dx, cy + dy);
        if (inRegion.has(nc)) c = nc;
      }
    }
  };
  const big = Math.floor(region.length / 22);

  // The ocean: void on the seaward side becomes deep "sea"; the floor that
  // fringes it becomes walkable "sand" (the shore).
  const floodSea = (onSeaSide: (x: number, y: number) => boolean) => {
    for (let i = 0; i < tiles.length; i++) {
      if (isBorder(i)) continue;
      const x = i % w;
      const y = (i - x) / w;
      if (tiles[i] === "cliff" && onSeaSide(x, y)) tiles[i] = "sea";
    }
    for (const c of region) {
      if (protectedCells.has(c) || tiles[c] !== "floor") continue;
      const x = c % w;
      const y = (c - x) / w;
      for (const [dx, dy] of NEI8) {
        const t = tiles[idx(w, Math.max(0, Math.min(w - 1, x + dx)), Math.max(0, Math.min(h - 1, y + dy)))];
        if (t === "sea") {
          tiles[c] = "sand";
          break;
        }
      }
    }
  };

  switch (biome) {
    case "coast": {
      const shore = Math.floor(w * 0.6);
      floodSea((x) => x >= shore);
      scatter("sand", big + rng.nextInt(4)); // dunes/dry beach inland
      scatter("water", 2 + rng.nextInt(3)); // tide pools
      clumps("grass", 2 + Math.round(danger * 3), 5 + Math.round(danger * 5));
      break;
    }
    case "isthmus": {
      // sea on both flanks (the narrow neck between two waters)
      const cxs = region.map((c) => c % w);
      const minX = Math.min(...cxs);
      const maxX = Math.max(...cxs);
      floodSea((x) => x < minX - 1 || x > maxX + 1);
      scatter("sand", big + rng.nextInt(3));
      scatter("water", 2 + rng.nextInt(3));
      clumps("grass", 2 + Math.round(danger * 3), 5 + Math.round(danger * 5));
      break;
    }
    case "desert":
      // mostly open sand, a little scrub, almost no water
      scatter("sand", Math.floor(region.length * (0.45 + 0.15 * rng.nextFloat())));
      scatter("water", rng.nextInt(2));
      clumps("grass", 1 + Math.round(danger * 2), 3 + Math.round(danger * 3));
      break;
    case "ruins":
      scatter("rubble", big * 2 + 3 + rng.nextInt(4));
      scatter("water", 1 + rng.nextInt(2));
      clumps("grass", 1 + Math.round(danger * 3), 4 + Math.round(danger * 4));
      break;
    case "mountain":
    case "alpine":
      scatter("rubble", big + 2 + rng.nextInt(3)); // scree
      scatter("water", rng.nextInt(2));
      clumps("grass", 1 + Math.round(danger * 2), 3 + Math.round(danger * 3));
      break;
    case "jungle":
      scatter("water", big + 2 + Math.round(lat * big) + rng.nextInt(3));
      scatter("rubble", 1 + rng.nextInt(2));
      clumps("grass", 4 + Math.round(danger * 6), 8 + Math.round(danger * 10));
      break;
    case "forest":
    default:
      scatter("water", big + 1 + Math.round(lat * big) + rng.nextInt(3));
      scatter("rubble", big + 1 + rng.nextInt(3));
      clumps("grass", 3 + Math.round(danger * 5), 7 + Math.round(danger * 9));
      break;
  }

  return { w, h, tiles, px: ex, py: ey, exitX: xx, exitY: xy, sites };
}

// Field of view: cells lit by a fire of `radius` at (px,py). A cell is visible
// if within radius and the line to it is not blocked by an opaque tile (the
// blocker is seen; nothing past it). Pure; the scene layers explored memory.
export function computeVisible(m: LocalMap, px: number, py: number, radius: number): Set<number> {
  const vis = new Set<number>();
  vis.add(idx(m.w, px, py));
  const r2 = radius * radius;
  for (let y = Math.max(0, py - radius); y <= Math.min(m.h - 1, py + radius); y++) {
    for (let x = Math.max(0, px - radius); x <= Math.min(m.w - 1, px + radius); x++) {
      if (x === px && y === py) continue;
      const ddx = x - px;
      const ddy = y - py;
      if (ddx * ddx + ddy * ddy > r2) continue;
      let cx = px;
      let cy = py;
      const sx = Math.abs(x - px);
      const sy = Math.abs(y - py);
      const stepX = px < x ? 1 : -1;
      const stepY = py < y ? 1 : -1;
      let err = sx - sy;
      let blocked = false;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (cx !== px || cy !== py) {
          if (cx === x && cy === y) break;
          if (isOpaque(m.tiles[idx(m.w, cx, cy)])) {
            blocked = true;
            break;
          }
        }
        const e2 = 2 * err;
        if (e2 > -sy) {
          err -= sy;
          cx += stepX;
        }
        if (e2 < sx) {
          err += sx;
          cy += stepY;
        }
      }
      if (!blocked) vis.add(idx(m.w, x, y));
    }
  }
  return vis;
}

export type MoveResult = "moved" | "blocked" | "exit";

// 4-dir step. Walls, cliffs and the sea block; floor/sand/water/rubble/grass
// are walkable. The exit is always open.
export function tryMove(m: LocalMap, dx: number, dy: number): MoveResult {
  const nx = m.px + dx;
  const ny = m.py + dy;
  const t = tileAt(m, nx, ny);
  if (isOpaque(t)) return "blocked";
  m.px = nx;
  m.py = ny;
  if (t === "exit") return "exit";
  return "moved";
}

export function siteAt(m: LocalMap, x: number, y: number): EncounterSite | undefined {
  for (const s of m.sites) if (s.x === x && s.y === y) return s;
  return undefined;
}

// --- pursuit (a duelist that hunts you once it spots you) ------------------
// A looker at (fx,fy) sees (tx,ty) using the SAME field of view as the player
// (computeVisible with the given radius — identical FOV + radius), so a `D`
// gets exactly the player's "area of vision".
export function canSeeFrom(
  m: LocalMap, fx: number, fy: number, tx: number, ty: number, radius: number,
): boolean {
  return computeVisible(m, fx, fy, radius).has(idx(m.w, tx, ty));
}

// One 4-dir step from (fx,fy) toward (tx,ty), going around walls along the
// dominant axis. Returns the new cell (or the same cell if boxed in this turn).
export function stepToward(
  m: LocalMap, fx: number, fy: number, tx: number, ty: number,
): [number, number] {
  const adx = tx - fx;
  const ady = ty - fy;
  const sx = Math.sign(adx);
  const sy = Math.sign(ady);
  const tries: Array<[number, number]> =
    Math.abs(adx) >= Math.abs(ady)
      ? [[sx, 0], [0, sy]]
      : [[0, sy], [sx, 0]];
  for (const [dx, dy] of tries) {
    if (dx === 0 && dy === 0) continue;
    const nx = fx + dx;
    const ny = fy + dy;
    if (isWalkable(tileAt(m, nx, ny))) return [nx, ny];
  }
  return [fx, fy];
}
