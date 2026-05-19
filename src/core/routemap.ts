// The overworld route map (DESIGN.md map layer 1). A deterministic, south-
// flowing node graph across the bible's 8 migration stages (§7). Ranks run
// north -> equator; each interior rank has a few branching nodes. The player
// chooses a path node-to-node instead of pressing on blindly. A node's rank is
// its stage, so latitude (and difficulty) rises as you descend.

import { Rng, seedFrom } from "../rng";
import { STAGES } from "./run";

// Nodes are no longer typed by a single encounter. A leg is just a stretch of
// the road south; what you meet is decided inside its cave (see localmap's
// EncounterSites). `danger` (0..1) rises with latitude and varies per leg —
// the only thing the route now signals.
export type NodeKind = "start" | "leg" | "end";

export interface MapNode {
  id: number;
  rank: number; // 0 .. ranks-1 ; also the stage index
  col: number;
  cols: number; // node count in this rank
  kind: NodeKind;
  danger: number; // 0..1; legs only (start/end are 0)
  next: number[];
}

export interface RouteMap {
  nodes: MapNode[];
  byRank: number[][]; // node ids per rank
  ranks: number;
  startId: number;
  endId: number;
  currentId: number;
  path: number[]; // node ids actually walked, in order (start .. current)
}

const RANKS = STAGES.length; // 8

function normPos(n: MapNode): number {
  return n.cols <= 1 ? 0.5 : n.col / (n.cols - 1);
}

export function makeRoute(runName: string): RouteMap {
  const rng = new Rng(seedFrom("route:" + runName));
  const nodes: MapNode[] = [];
  const byRank: number[][] = [];
  let id = 0;

  for (let r = 0; r < RANKS; r++) {
    let count: number;
    if (r === 0 || r === RANKS - 1) count = 1;
    else count = 2 + rng.nextInt(3); // 2..4
    const ids: number[] = [];
    for (let c = 0; c < count; c++) {
      const kind: NodeKind = r === 0 ? "start" : r === RANKS - 1 ? "end" : "leg";
      // Danger rises with latitude; each leg jitters so siblings differ.
      const lat = r / (RANKS - 1);
      const danger =
        kind === "leg" ? Math.max(0, Math.min(1, 0.18 + 0.72 * lat + (rng.nextFloat() - 0.5) * 0.28)) : 0;
      nodes.push({ id, rank: r, col: c, cols: count, kind, danger, next: [] });
      ids.push(id);
      id += 1;
    }
    byRank.push(ids);
  }

  // Edges: each node links to the nearest-by-column node in the next rank,
  // sometimes a branch; then guarantee every next-rank node has an entrance.
  for (let r = 0; r < RANKS - 1; r++) {
    const a = byRank[r].map((i) => nodes[i]);
    const b = byRank[r + 1].map((i) => nodes[i]);
    const indeg = new Array(b.length).fill(0);
    for (let k = 0; k < a.length; k++) {
      const n = a[k];
      const ti = Math.round(normPos(n) * (b.length - 1));
      link(n, b[ti]);
      indeg[ti] += 1;
      if (b.length > 1 && rng.chance(0.5)) {
        const dir = rng.chance(0.5) ? 1 : -1;
        const tj = Math.max(0, Math.min(b.length - 1, ti + dir));
        if (tj !== ti) {
          link(n, b[tj]);
          indeg[tj] += 1;
        }
      }
    }
    for (let j = 0; j < b.length; j++) {
      if (indeg[j] > 0) continue;
      // Orphan: connect from the column-closest predecessor.
      let best = a[0];
      let bestD = Infinity;
      for (let k = 0; k < a.length; k++) {
        const d = Math.abs(normPos(a[k]) - j / Math.max(1, b.length - 1));
        if (d < bestD) {
          bestD = d;
          best = a[k];
        }
      }
      link(best, b[j]);
    }
  }

  return {
    nodes,
    byRank,
    ranks: RANKS,
    startId: byRank[0][0],
    endId: byRank[RANKS - 1][0],
    currentId: byRank[0][0],
    path: [byRank[0][0]],
  };
}

function link(from: MapNode, to: MapNode): void {
  if (!from.next.includes(to.id)) from.next.push(to.id);
}

export function nodeById(map: RouteMap, id: number): MapNode {
  return map.nodes[id];
}

export function currentNode(map: RouteMap): MapNode {
  return map.nodes[map.currentId];
}

// The nodes the player may move to from where they stand.
export function reachable(map: RouteMap): MapNode[] {
  return currentNode(map).next.map((i) => map.nodes[i]);
}

export function moveTo(map: RouteMap, id: number): boolean {
  if (!currentNode(map).next.includes(id)) return false;
  map.currentId = id;
  map.path.push(id); // record the branch actually walked (for the chart)
  return true;
}

export function isAtEnd(map: RouteMap): boolean {
  return currentNode(map).kind === "end";
}

// A node's rank is its stage index (clamped into STAGES range).
export function stageOf(node: MapNode): number {
  return Math.max(0, Math.min(STAGES.length - 1, node.rank));
}
