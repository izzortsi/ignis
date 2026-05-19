import { describe, it, expect } from "vitest";
import {
  makeRoute,
  reachable,
  moveTo,
  currentNode,
  isAtEnd,
  stageOf,
  type RouteMap,
} from "./routemap";
import { STAGES } from "./run";

function pathExists(map: RouteMap): boolean {
  const seen = new Set<number>([map.startId]);
  const stack = [map.startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === map.endId) return true;
    for (const n of map.nodes[id].next) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return false;
}

describe("Overworld route map", () => {
  it("is deterministic for a run name", () => {
    const a = makeRoute("trek");
    const b = makeRoute("trek");
    expect(a.nodes.map((n) => `${n.rank}:${n.kind}:${n.next.join(",")}`)).toEqual(
      b.nodes.map((n) => `${n.rank}:${n.kind}:${n.next.join(",")}`),
    );
    expect(makeRoute("other").nodes.length).not.toBe(-1); // smoke: builds
  });

  it("spans all stages, start and end singular", () => {
    const m = makeRoute("span");
    expect(m.ranks).toBe(STAGES.length);
    expect(m.byRank[0].length).toBe(1);
    expect(m.byRank[m.ranks - 1].length).toBe(1);
    expect(m.nodes[m.startId].kind).toBe("start");
    expect(m.nodes[m.endId].kind).toBe("end");
  });

  it("there is always a path from start to the equator", () => {
    for (const name of ["a", "b", "c", "seed-42", "longwalk", "izzortsi"]) {
      expect(pathExists(makeRoute(name))).toBe(true);
    }
  });

  it("every non-end node has an exit and every non-start node an entrance", () => {
    const m = makeRoute("connectivity");
    const indeg = new Map<number, number>();
    for (const n of m.nodes) for (const t of n.next) indeg.set(t, (indeg.get(t) ?? 0) + 1);
    for (const n of m.nodes) {
      if (n.kind !== "end") expect(n.next.length).toBeGreaterThan(0);
      if (n.id !== m.startId) expect(indeg.get(n.id) ?? 0).toBeGreaterThan(0);
    }
  });

  it("moving follows edges and only edges", () => {
    const m = makeRoute("move");
    const opts = reachable(m);
    expect(opts.length).toBeGreaterThan(0);
    expect(moveTo(m, 999999)).toBe(false); // not an edge
    expect(moveTo(m, opts[0].id)).toBe(true);
    expect(currentNode(m).id).toBe(opts[0].id);
  });

  it("walking the whole route reaches the end and rising rank = rising stage", () => {
    const m = makeRoute("walk-it");
    let guard = 0;
    let lastStage = -1;
    while (!isAtEnd(m) && guard++ < 50) {
      const stage = stageOf(currentNode(m));
      expect(stage).toBeGreaterThanOrEqual(lastStage);
      lastStage = stage;
      const opts = reachable(m);
      moveTo(m, opts[0].id);
    }
    expect(isAtEnd(m)).toBe(true);
  });

  it("records the walked path: start only, then each legal move appended", () => {
    const m = makeRoute("trail");
    expect(m.path).toEqual([m.startId]);
    expect(moveTo(m, 999999)).toBe(false);
    expect(m.path).toEqual([m.startId]); // illegal move never touches the path

    const steps: number[] = [m.startId];
    let guard = 0;
    while (!isAtEnd(m) && guard++ < 50) {
      const next = reachable(m)[0].id;
      moveTo(m, next);
      steps.push(next);
    }
    expect(m.path).toEqual(steps); // exactly the branch walked, in order
    expect(m.path[0]).toBe(m.startId);
    expect(m.path[m.path.length - 1]).toBe(m.currentId);
    // consecutive path nodes are real edges, ranks strictly rise
    for (let i = 1; i < m.path.length; i++) {
      expect(m.nodes[m.path[i - 1]].next).toContain(m.path[i]);
      expect(m.nodes[m.path[i]].rank).toBe(m.nodes[m.path[i - 1]].rank + 1);
    }
  });

  it("interior nodes are legs and danger trends upward with latitude", () => {
    const m = makeRoute("danger-check");
    const legs = m.nodes.filter((n) => n.kind === "leg");
    expect(legs.length).toBeGreaterThan(0);
    for (const n of legs) {
      expect(n.danger).toBeGreaterThanOrEqual(0);
      expect(n.danger).toBeLessThanOrEqual(1);
    }
    const north = legs.filter((n) => n.rank <= 2).reduce((a, n) => a + n.danger, 0);
    const south = legs.filter((n) => n.rank >= 5).reduce((a, n) => a + n.danger, 0);
    const nN = legs.filter((n) => n.rank <= 2).length || 1;
    const nS = legs.filter((n) => n.rank >= 5).length || 1;
    expect(south / nS).toBeGreaterThan(north / nN);
  });
});
