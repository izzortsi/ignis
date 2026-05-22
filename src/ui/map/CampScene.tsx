// The camp — the persistent hub AND the route map (bible §6 chapada). A reskin
// of ludus-ignis's CampMap shell. From here the reachable legs appear as
// numbered SOUTH GATES: walk into one (or press its number) to take that
// dungeon; you return here after. The Cinder keeps the tally (dex / caught /
// memorial). Loop: camp → gate → cave → camp → … → the equator.

import { createSignal, createMemo, onMount, onCleanup, Show, For } from "solid-js";
import {
  buildCampArt, buildPaths, pathCells, pathWalkCells, gateMarkerCells,
  MAP_DIMS, FRAMES,
  HEARTH_FIRE_FRAMES, CINDER_FIRE_FRAMES,
  AURORA_FRAMES, AURORA_FRAMES_COUNT,
  isWalkable, interactableAt,
  APPRENTICE_SPAWN,
  type InteractableId, type PathGate, type GateMarker,
} from "./map-art";
import { biomeOf } from "../../core/localmap";
import {
  recruitFromCaught,
  releaseFromCircle,
  inCircle,
  hasMemory,
  type RunState,
} from "../../core/run";
import { FLASHBACKS } from "../../core/flashback";
import { FLASH_ART, flashThumb, flashFull } from "../flashArt";
import { reachable, type RouteMap, type MapNode } from "../../core/routemap";
import { Rng, seedFrom } from "../../rng";
import { kindle, deepTendFire, type Cinder } from "../../core/cinder";
import { teachableMoves, teachSkill, canTeach } from "../../core/battle";
import { teachFelt, tribeFelt } from "../../core/battle-felt";
import { stageFlavor } from "../../core/stages";
import { useCache } from "../../core/inventory";
import { InventoryDialog } from "../inventory/InventoryDialog";
import { partsForName, cinderFramesStable, HUE_COLOR } from "../../core/petart";
import { PLAYER_SPRITE, CINDER_FOLLOW } from "../../screen";

const SPRITE = PLAYER_SPRITE;

function dangerWord(n: MapNode): string {
  if (n.kind === "end") return "the equator";
  const d = n.danger;
  return d < 0.33 ? "an easy leg" : d < 0.6 ? "an uneasy leg" : d < 0.82 ? "a hard leg" : "a grim leg";
}

interface Gate {
  node: MapNode;
  row: number;
  col: number;
}

// Place one walkable gate per reachable leg, spread across the southern band.
function placeGates(route: RouteMap): Gate[] {
  const legs = reachable(route);
  if (legs.length === 0) return [];
  const band: Array<{ r: number; c: number }> = [];
  const top = Math.floor(MAP_DIMS.rows * 0.6);
  for (let r = MAP_DIMS.rows - 2; r >= top; r--) {
    for (let c = 1; c < MAP_DIMS.cols - 1; c++) if (isWalkable(r, c)) band.push({ r, c });
  }
  if (band.length === 0) {
    // Degenerate fallback: stack them on the spawn row.
    return legs.map((node, i) => ({ node, row: APPRENTICE_SPAWN.row, col: APPRENTICE_SPAWN.col + 2 + i * 2 }));
  }
  const gates: Gate[] = [];
  const used = new Set<number>();
  for (let i = 0; i < legs.length; i++) {
    const targetC = Math.round(((i + 0.5) / legs.length) * (MAP_DIMS.cols - 1));
    let best = band[0];
    let bestScore = Infinity;
    for (const cell of band) {
      const key = cell.r * MAP_DIMS.cols + cell.c;
      if (used.has(key)) continue;
      // southmost first, then nearest the bucket column
      const score = (MAP_DIMS.rows - cell.r) * 4 + Math.abs(cell.c - targetC);
      if (score < bestScore) {
        bestScore = score;
        best = cell;
      }
    }
    used.add(best.r * MAP_DIMS.cols + best.c);
    gates.push({ node: legs[i], row: best.r, col: best.c });
  }
  return gates;
}

export function CampScene(props: {
  cinderName: string;
  run: RunState;
  route: RouteMap;
  onEnterLeg: (node: MapNode) => void;
}) {
  const [r0, c0] = [APPRENTICE_SPAWN.row, APPRENTICE_SPAWN.col];
  const [row, setRow] = createSignal(r0);
  const [col, setCol] = createSignal(c0);
  const [step, setStep] = createSignal(0);
  // The bonded Cinder trails one step behind (takes the apprentice's old cell).
  const [cinderRow, setCinderRow] = createSignal(r0);
  const [cinderCol, setCinderCol] = createSignal(c0);
  const [auroraTick, setAuroraTick] = createSignal(0);
  const [fireTick, setFireTick] = createSignal(0);
  const [dialog, setDialog] = createSignal<InteractableId | null>(null);
  type TabId = "circle" | "stable" | "memories";
  const [tab, setTab] = createSignal<TabId>("circle");
  // A recovered memory whose full dense card is expanded (click to toggle).
  const [openMem, setOpenMem] = createSignal<string | null>(null);
  // Keyboard cursor over the memory cards (↑/↓ select, Enter/Space open).
  const [memSel, setMemSel] = createSignal(0);
  // The ancient fire (Hearth): teaches ONE eligible skill per camp visit to
  // any chosen Circle fire. taughtThisVisit resets every camp visit because
  // CampScene remounts per visit (App's Switch/Match).
  const [hearthFire, setHearthFire] = createSignal(0);
  // The Hearth has ONE action per camp visit (DESIGN.md §8 revision —
  // survival vs build): either teach a skill OR deeply tend a fire to brim.
  const [hearthSpentThisVisit, setHearthSpentThisVisit] = createSignal(false);
  const [hearthNotice, setHearthNotice] = createSignal("");
  // The constellation route-overview (whole branches). Hotkey M toggles it;
  // the reachable stars are selectable — choosing one takes that leg (the
  // same `onEnterLeg` the south gates call), so the chart IS a route menu.
  const [mapOpen, setMapOpen] = createSignal(false);
  const [mapSel, setMapSel] = createSignal(0);
  const [inventoryOpen, setInventoryOpen] = createSignal(false);

  // Take the i-th reachable branch straight from the chart (i indexes
  // reachable(route) — the same order the south gates are numbered).
  function takeLeg(i: number): void {
    const reach = reachable(props.route);
    if (i >= 0 && i < reach.length) {
      setMapOpen(false);
      props.onEnterLeg(reach[i]);
    }
  }
  // Bumped on recruit/release/teach so the roster re-renders (run.circle and
  // cinder.skills are plain — Solid won't track their mutation otherwise).
  const [rosterBeat, bumpRoster] = createSignal(0, { equals: false });

  const hearthC = () => props.run.circle[hearthFire()];
  const hearthName = () => { const c = hearthC(); return c ? c.name : "—"; };
  const hearthTeachable = () => { rosterBeat(); const c = hearthC(); return c ? teachableMoves(c) : []; };
  function doTeach(id: string): void {
    if (hearthSpentThisVisit()) return;
    const c = hearthC();
    if (c && teachSkill(c, id)) { setHearthSpentThisVisit(true); bumpRoster(0); }
  }
  // Deep tend — the Hearth pours itself over the entire Circle, fully
  // restoring every living fire's vitality and coherence. Mutually exclusive
  // with teaching: one Hearth action per camp visit (DESIGN.md §8 revision).
  // A snuffed fire is not revived here — only tendFires re-embers a bonded
  // loss into a fresh Hearth ember.
  function doDeepTend(): void {
    if (hearthSpentThisVisit()) return;
    let any = false;
    for (const c of props.run.circle) {
      if (deepTendFire(c)) any = true;
    }
    if (any) {
      setHearthSpentThisVisit(true);
      setHearthNotice("the Hearth tends the Circle");
      bumpRoster(0);
    }
  }

  function circleNeedsTend(): boolean {
    for (const c of props.run.circle) {
      if (c.vitality > 0 && (c.vitality < 1 || c.coherenceFrac < 1)) return true;
    }
    return false;
  }

  // B2.3: cache-powered free tend. Consumes one cache and deep-tends the
  // whole Circle without spending the Hearth's one action this visit.
  // Refuses to waste a cache when the Circle is already whole.
  function doCacheTend(): void {
    if (!circleNeedsTend()) {
      setHearthNotice("the Circle is already whole");
      bumpRoster(0);
      return;
    }
    if (!useCache(props.run.inventory)) {
      setHearthNotice("no cache to spend");
      bumpRoster(0);
      return;
    }
    let any = false;
    for (const c of props.run.circle) {
      if (deepTendFire(c)) any = true;
    }
    if (any) {
      setHearthNotice("cache spent — the Circle is restored");
      bumpRoster(0);
    }
  }

  function toggleCaught(name: string): void {
    if (inCircle(props.run, name)) releaseFromCircle(props.run, name);
    else recruitFromCaught(props.run, name);
    bumpRoster(0);
  }

  // One numbering over EVERY actionable fire so the keys match what's shown:
  // non-bonded circle fires (a number releases them), then caught fires not in
  // the circle (a number recruits them). The bonded fire (circle[0]) has no
  // number — it can't be released. order[i] feeds toggleCaught, which already
  // releases-or-recruits by name, so run.ts is untouched.
  const numbers = createMemo(() => {
    rosterBeat();
    const m = new Map<string, number>();
    const order: string[] = [];
    for (let k = 1; k < props.run.circle.length; k++) {
      const nm = props.run.circle[k].name;
      if (!m.has(nm)) { order.push(nm); m.set(nm, order.length); }
    }
    for (const e of props.run.meta.caught) {
      if (!inCircle(props.run, e.name) && !m.has(e.name)) {
        order.push(e.name); m.set(e.name, order.length);
      }
    }
    return { m, order };
  });

  const gates = placeGates(props.route);
  // Pass B (DESIGN.md §5): gates are anchors for path geometry but the gate
  // marker (digit + leg-trigger cell) lives at the END of the path, off the
  // plateau, where the road meets off-canvas south. Walking onto a marker
  // cell triggers onEnterLeg.
  const pathGatesForWalk: PathGate[] = gates.map((g) => ({
    biome: biomeOf(g.node.rank),
    gateRow: g.row,
    gateCol: g.col,
  }));
  const walkable = pathWalkCells(pathGatesForWalk);
  const markers: GateMarker[] = gateMarkerCells(pathGatesForWalk);
  // gateAt resolves a target cell to its leg by checking marker positions.
  // markers order matches gates order so gates[idx] gives the right node.
  const gateAt = (rr: number, cc: number) => {
    const idx = markers.findIndex((m) => m.row === rr && m.col === cc);
    return idx >= 0 ? gates[idx] : undefined;
  };

  // Biome-aware camp art (DESIGN.md §5 / camp-reflects-stage). The Hearth
  // pit, Cinder vessel, fire frames, aurora, walkability, and plateau shape
  // all stay constant; the plateau-edge glyph, interior speckle, scree, and
  // star density shift with the current stage's biome. The terrain build
  // also receives a skip-set of cells where paths will be — cliff edge isn't
  // painted there, so the path emerges as a genuine break in the silhouette.
  const skipCells = createMemo(() => {
    const pathGates: PathGate[] = gates.map((g) => ({
      biome: biomeOf(g.node.rank),
      gateRow: g.row,
      gateCol: g.col,
    }));
    return pathCells(pathGates);
  });
  const campArt = createMemo(() => buildCampArt(biomeOf(props.run.stageIndex), skipCells()));

  // Visual paths extending south from each reachable gate (DESIGN.md §5),
  // biome-textured to hint where the road leads. The shape of the camp's
  // southern side now shifts with the number of gates — 2 means 2 spokes,
  // 4 means 4. Re-evaluates when gates change (between legs).
  const paths = createMemo(() => {
    const pathGates: PathGate[] = gates.map((g) => ({
      biome: biomeOf(g.node.rank),
      gateRow: g.row,
      gateCol: g.col,
    }));
    return buildPaths(pathGates);
  });

  onMount(() => {
    const a = window.setInterval(() => setAuroraTick((t) => (t + 1) % AURORA_FRAMES_COUNT), 140);
    const c = window.setInterval(() => setFireTick((t) => (t + 1) % FRAMES), 120);
    onCleanup(() => {
      clearInterval(a);
      clearInterval(c);
    });
  });

  function tryMove(dr: number, dc: number) {
    const tr = row() + dr;
    const tc = col() + dc;
    const g = gateAt(tr, tc);
    if (g) {
      props.onEnterLeg(g.node);
      return;
    }
    const id = interactableAt(tr, tc);
    if (id !== null) {
      if (id === "cinder") setTab("circle"); // always open on the circle tab
      if (id === "hearth") setHearthFire(0); // start on the bonded fire
      setDialog(id);
      return;
    }
    if (isWalkable(tr, tc) || walkable.has(`${tr},${tc}`)) {
      setCinderRow(row()); // the Cinder takes the cell you just left
      setCinderCol(col());
      setRow(tr);
      setCol(tc);
      setStep((s) => s + 1);
    }
  }

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (inventoryOpen()) {
        if (e.key === "Escape" || e.key === "Enter" || e.key === "i" || e.key === "I") {
          e.preventDefault();
          setInventoryOpen(false);
        }
        return;
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setDialog(null);
        setMapOpen(false);
        setInventoryOpen(true);
        return;
      }
      if (mapOpen()) {
        e.preventDefault(); // the chart owns input while it's up
        const reach = reachable(props.route);
        const n = reach.length;
        if (e.key === "Escape" || e.key === "m" || e.key === "M") { setMapOpen(false); return; }
        if (n > 0 && (e.key === "ArrowLeft" || e.key === "ArrowUp")) {
          setMapSel((mapSel() + n - 1) % n);
          return;
        }
        if (n > 0 && (e.key === "ArrowRight" || e.key === "ArrowDown")) {
          setMapSel((mapSel() + 1) % n);
          return;
        }
        if (e.key === "Enter" || e.key === " ") { takeLeg(mapSel()); return; }
        if (e.key >= "1" && e.key <= "9") { takeLeg(Number(e.key) - 1); return; }
        return;
      }
      const d = dialog();
      if (d !== null) {
        if (e.key === "Escape") { e.preventDefault(); setDialog(null); return; }
        if (d === "cinder" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
          const tabs: TabId[] = ["circle", "stable", "memories"];
          const ti = tabs.indexOf(tab());
          const nt = tabs[(ti + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
          setTab(nt);
          if (nt === "memories") setMemSel(0);
          return;
        }
        if (d === "cinder" && tab() === "memories") {
          // ↑/↓ move the card cursor; Enter/Space opens the selected memory.
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const n = FLASHBACKS.length;
            setMemSel((memSel() + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const fb = FLASHBACKS[memSel()];
            if (fb && hasMemory(meta, fb.id)) setOpenMem(openMem() === fb.id ? null : fb.id);
            return;
          }
        }
        if (d === "hearth") {
          // ↑/↓ pick which Circle fire; a digit teaches its Nth eligible
          // skill; T deeply tends the chosen fire. One Hearth action per
          // camp visit, survival vs build (DESIGN.md §8). Digits are owned
          // so browser find never eats them.
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const n = props.run.circle.length;
            if (n > 0) setHearthFire((hearthFire() + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
            return;
          }
          if (e.key === "t" || e.key === "T") {
            e.preventDefault();
            doDeepTend();
            return;
          }
          if (e.key === "c" || e.key === "C") {
            e.preventDefault();
            doCacheTend();
            return;
          }
          if (e.key >= "1" && e.key <= "9") {
            e.preventDefault();
            const opts = hearthTeachable();
            const i = Number(e.key) - 1;
            if (i < opts.length) doTeach(opts[i].id);
            return;
          }
        }
        if (e.key === "Enter") { e.preventDefault(); setDialog(null); return; }
        if (d === "cinder" && e.key >= "1" && e.key <= "9") {
          // Always own the digit so the browser's find/type-ahead never
          // captures it — even when it maps to nothing. Recruit/release only
          // from the roster tabs (not while browsing memories).
          e.preventDefault();
          if (tab() !== "memories") {
            const i = Number(e.key) - 1;
            const order = numbers().order;
            if (i < order.length) toggleCaught(order[i]);
          }
        }
        return;
      }
      if (e.key === "m" || e.key === "M") { e.preventDefault(); setMapSel(0); setMapOpen(true); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); tryMove(-1, 0); }
      else if (e.key === "ArrowDown") { e.preventDefault(); tryMove(1, 0); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); tryMove(0, -1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); tryMove(0, 1); }
      else if (e.key >= "1" && e.key <= "9") {
        e.preventDefault(); // own the digit even if no gate has that number
        const i = Number(e.key) - 1;
        if (i < gates.length) props.onEnterLeg(gates[i].node);
      }
    }
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // The whole route as a star chart (DESIGN: constellation overview). The
  // DAG draw is ported from the retired scenes/run.ts: ranks are rows, a
  // blank edge-row sits between them, columns are centred per rank. Built
  // once per camp visit (the route only changes when you leave for a leg).
  const constGrid = createMemo<Array<Array<{ ch: string; cls: string }>>>(() => {
    const rt = props.route;
    const reach = reachable(rt); // same order the south gates are numbered
    const selId = reach.length
      ? reach[Math.max(0, Math.min(reach.length - 1, mapSel()))].id
      : -1;
    const gate = new Map<number, number>();
    reach.forEach((n, i) => gate.set(n.id, i + 1));
    const onPath = new Set(rt.path);
    let maxCols = 1;
    for (const ids of rt.byRank) maxCols = Math.max(maxCols, ids.length);
    const W = Math.max(9, maxCols * 6 + 3);
    const H = rt.ranks * 2 - 1;

    // A faint, deterministic night sky behind the route (stable per run).
    const sky = new Rng(seedFrom("sky:" + props.run.runName));
    const SPECKS = ["·", "˚", "·", "⋆", ".", "'"];
    const grid: Array<Array<{ ch: string; cls: string }>> = [];
    for (let y = 0; y < H; y++) {
      const r: Array<{ ch: string; cls: string }> = [];
      for (let x = 0; x < W; x++) {
        r.push(
          sky.chance(0.07)
            ? { ch: SPECKS[sky.nextInt(SPECKS.length)], cls: "c-sky" }
            : { ch: " ", cls: "c-void" },
        );
      }
      grid.push(r);
    }

    const xOf = (col: number, cols: number) =>
      Math.max(1, Math.min(W - 2, Math.round(((col + 0.5) / cols) * (W - 1))));
    for (let rk = 0; rk < rt.ranks; rk++) {
      const ids = rt.byRank[rk];
      const y = rk * 2;
      for (let c = 0; c < ids.length; c++) {
        const n = rt.nodes[ids[c]];
        const x = xOf(n.col, ids.length);
        const isCur = n.id === rt.currentId;
        const g = gate.get(n.id);
        // The equator is always a visible beacon you're walking toward.
        const isEnd = n.kind === "end";
        const isSel = n.id === selId; // the branch the chart cursor is on
        const cls = isCur
          ? "c-cur"
          : isSel
            ? "c-sel"
            : isEnd
              ? "c-end"
              : g !== undefined
                ? "c-reach"
                : onPath.has(n.id)
                  ? "c-path"
                  : "c-lock";
        const ch = isCur
          ? "✦"
          : n.kind === "start"
            ? "◉"
            : isEnd
              ? "✺"
              : g !== undefined
                ? "✧"
                : onPath.has(n.id)
                  ? "✶"
                  : "⋆";
        // A small clear-zone so a star (and its gate mark) stays crisp
        // against the ambient field.
        for (let dx = -2; dx <= 1; dx++) {
          const cx = x + dx;
          if (cx >= 0 && cx < W && grid[y][cx].cls === "c-sky") {
            grid[y][cx] = { ch: " ", cls: "c-void" };
          }
        }
        grid[y][x] = { ch, cls };
        if (g !== undefined && x - 2 >= 0) grid[y][x - 2] = { ch: String(g), cls: isSel ? "c-sel" : "c-reach" };
        if (rk < rt.ranks - 1) {
          for (const tid of n.next) {
            const tn = rt.nodes[tid];
            const tx = xOf(tn.col, rt.byRank[tn.rank].length);
            const mx = Math.max(0, Math.min(W - 1, Math.round((x + tx) / 2)));
            const lit = onPath.has(n.id) && onPath.has(tid); // a walked stroke
            const cell = grid[y + 1][mx];
            if (cell.cls !== "c-trail") {
              grid[y + 1][mx] = {
                ch: tx === x ? "│" : tx > x ? "╲" : "╱",
                cls: lit ? "c-trail" : "c-edge",
              };
            }
          }
        }
      }
    }
    return grid;
  });

  const sprite = createMemo(() => {
    const g = SPRITE[step() % SPRITE.length];
    const cg = CINDER_FOLLOW[fireTick() % CINDER_FOLLOW.length];
    const cr = cinderRow();
    const cc = cinderCol();
    const lines: string[] = [];
    for (let rr = 0; rr < MAP_DIMS.rows; rr++) {
      const cells = new Array(MAP_DIMS.cols).fill(" ");
      // Cinder first; the apprentice overwrites it if they share a cell.
      if (rr === cr && cc >= 0 && cc < MAP_DIMS.cols) cells[cc] = cg;
      if (rr === row() && col() >= 0 && col() < MAP_DIMS.cols) cells[col()] = g;
      lines.push(cells.join(""));
    }
    return lines.join("\n");
  });

  // Static gate layer — numbered markers at the END of each path (off the
  // plateau, where the road terminates). Pass B (DESIGN.md §5): walking
  // onto a marker triggers onEnterLeg via gateAt.
  const gateLayer = createMemo(() => {
    const grid: string[][] = [];
    for (let rr = 0; rr < MAP_DIMS.rows; rr++) grid.push(new Array(MAP_DIMS.cols).fill(" "));
    markers.forEach((m, i) => {
      if (m.row >= 0 && m.row < MAP_DIMS.rows && m.col >= 0 && m.col < MAP_DIMS.cols) {
        grid[m.row][m.col] = String(i + 1);
      }
    });
    return grid.map((rw) => rw.join("")).join("\n");
  });

  const meta = props.run.meta; // live run meta (recruit reads/writes the same)

  // A caught/circle fire shown as its mochi creature (deterministic from name).
  // Renders the LIVE Cinder (mirrors BattleEncounter.CinderSprite): parts /
  // frames / colour are accessors, so the real fire's state drives the art —
  // the bonded fire stays the emberling mascot (canonStage), a snuffed fire
  // shows the smoke `dead` frame, and the list reflects state changes. It must
  // be handed the real Cinder, never a name-rebuilt stand-in (which reset
  // vitality/level/bond and suppressed the dead frame).
  function FireSprite(p: { c: () => Cinder }) {
    const parts = () => partsForName(p.c().name);
    const frames = () => cinderFramesStable(p.c());
    const col = () =>
      "#" + ((HUE_COLOR[parts().hue] ?? 0xffaa44) >>> 0).toString(16).padStart(6, "0");
    return (
      <pre class="camp-fire-art" style={{ color: col() }}>
        {(() => {
          const f = frames();
          return f[fireTick() % f.length].join("\n");
        })()}
      </pre>
    );
  }

  return (
    <div class="camp-root">
      <div class="camp-stage-wrap">
        <div class="map-stage" style={{ "--cols": MAP_DIMS.cols, "--rows": MAP_DIMS.rows }}>
          <pre class="map-filler">{Array(MAP_DIMS.rows).fill(" ".repeat(MAP_DIMS.cols)).join("\n")}</pre>
          <pre class="map-layer map-stars">{campArt().stars}</pre>
          <pre class="map-layer map-aurora">{AURORA_FRAMES[auroraTick()]}</pre>
          <pre class="map-layer map-scree">{campArt().scree}</pre>
          <pre class="map-layer map-terrain">{campArt().terrain.join("\n")}</pre>
          <pre class="map-layer map-paths">{paths()}</pre>
          <pre class="map-layer map-hearth-fire">{HEARTH_FIRE_FRAMES[fireTick()]}</pre>
          <pre class="map-layer map-cinder-fire">{CINDER_FIRE_FRAMES[fireTick()]}</pre>
          <pre class="map-layer map-gates">{gateLayer()}</pre>
          <pre class="map-layer map-apprentice">{sprite()}</pre>
        </div>
      </div>

      <Show when={dialog() === "hearth"}>
        <div class="camp-dialog camp-roster">
          <p class="camp-roster-head">
            The ancient fire roars over the chapada — it outlasts every run, and
            grants one rite per camp visit: deeply tend a fire, OR teach it what
            it is ready to learn. <em>One Hearth action per camp.</em>
          </p>
          <div class="camp-tabpane">
            <p class="title-dex-cap">whose fire? (↑/↓)</p>
            <div class="camp-fire-list">
              <For each={(rosterBeat(), props.run.circle.slice())}>
                {(c, i) => (
                  <button
                    class="camp-fire-act"
                    classList={{ "is-in": i() === hearthFire() }}
                    onClick={() => setHearthFire(i())}
                  >
                    {c.name}{i() === 0 ? " ·bonded" : ""}
                  </button>
                )}
              </For>
            </div>

            <Show
              when={!hearthSpentThisVisit()}
              fallback={<p class="title-dex-none">the ancient fire has given what it can — return after a leg</p>}
            >
              {/* Deep tend — the survival choice. The Hearth pours itself over
                  the whole Circle, fully restoring every living fire. */}
              <p class="title-dex-cap">the Circle — survive:</p>
              <div class="camp-fire-list">
                <button
                  class="camp-fire-act"
                  onClick={() => doDeepTend()}
                >
                  [T] deep tend the Circle{" "}
                  <span class="title-dex-dim">· every living fire fully restored, body and breath</span>
                </button>
                <button
                  class="camp-fire-act"
                  classList={{ "is-spent": (rosterBeat(), props.run.inventory.caches <= 0 || !circleNeedsTend()) }}
                  disabled={(rosterBeat(), props.run.inventory.caches <= 0)}
                  onClick={() => doCacheTend()}
                >
                  [C] spend cache{" "}
                  <span class="title-dex-dim">· free deep tend · caches {(rosterBeat(), props.run.inventory.caches)}</span>
                </button>
              </div>
              <Show when={hearthNotice().length > 0}>
                <p class="title-dex-dim">{hearthNotice()}</p>
              </Show>

              {/* Teach — the build choice. Gated on readiness + banked XP. */}
              <p class="title-dex-cap">{hearthName()} — or build:</p>
              <Show
                when={hearthTeachable().length > 0}
                fallback={<p class="title-dex-none">— nothing yet to teach; this fire must grow before it can learn more —</p>}
              >
                <div class="camp-fire-list">
                  <For each={hearthTeachable()}>
                    {(m, i) => {
                      const ok = () => { rosterBeat(); const c = hearthC(); return c ? canTeach(c, m) : false; };
                      return (
                        <button
                          class="camp-fire-act"
                          classList={{ "is-spent": !ok() }}
                          disabled={!ok()}
                          onClick={() => doTeach(m.id)}
                        >
                          [{i() + 1}] teach {m.name}{" "}
                          <span class="title-dex-dim">· {m.type} — {teachFelt(ok(), true)}</span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </Show>
          </div>
          <p class="camp-dialog-hint">↑/↓ fire · [T] deep tend · [C] spend cache · number: teach (one Hearth action per camp) · [Esc] back</p>
        </div>
      </Show>
      <Show when={dialog() === "cinder"}>
        <div class="camp-dialog camp-roster">
          <p class="camp-roster-head">Your bonded Cinder: <em>{props.cinderName}</em></p>

          <div class="camp-tabs" role="tablist">
            <button class="camp-tab" classList={{ "is-sel": tab() === "circle" }} onClick={() => setTab("circle")}>
              circle ({(rosterBeat(), props.run.circle.length)})
            </button>
            <button class="camp-tab" classList={{ "is-sel": tab() === "stable" }} onClick={() => setTab("stable")}>
              stable ({(rosterBeat(), props.run.meta.caught.length)})
            </button>
            <button class="camp-tab" classList={{ "is-sel": tab() === "memories" }} onClick={() => { setTab("memories"); setMemSel(0); }}>
              memories ({meta.memories.length}/{FLASHBACKS.length})
            </button>
          </div>

          <div class="camp-tabpane">
            <Show when={tab() === "circle"}>
              <div class="camp-fire-list">
                <For each={(rosterBeat(), props.run.circle.slice())}>
                  {(c, i) => (
                    <div class="camp-fire">
                      <FireSprite c={() => c} />
                      <p class="camp-fire-name">
                        {i() === 0 ? "" : `[${numbers().m.get(c.name)}] `}{c.name}{i() === 0 ? " ·bonded" : ""}
                      </p>
                      <Show when={i() !== 0}>
                        <button class="camp-fire-act" onClick={() => toggleCaught(c.name)}>release</button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={tab() === "stable"}>
              <Show
                when={props.run.meta.caught.length > 0}
                fallback={<p class="title-dex-none">— none yet; best a wild fire in a battle —</p>}
              >
                <div class="camp-fire-list">
                  <For each={(rosterBeat(), props.run.meta.caught.slice())}>
                    {(e) => {
                      const here = () => (rosterBeat(), inCircle(props.run, e.name));
                      // Caught entries are {name,stage} records, not live
                      // Cinders — a once-built name-preview is correct here.
                      const preview = kindle(e.name, false);
                      return (
                        <div class="camp-fire">
                          <FireSprite c={() => preview} />
                          <p class="camp-fire-name">{here() ? "" : `[${numbers().m.get(e.name)}] `}{e.name}</p>
                          <p class="title-dex-dim">{partsForName(e.name).rarity} · {e.stage}</p>
                          <button
                            class="camp-fire-act"
                            classList={{ "is-in": here() }}
                            onClick={() => toggleCaught(e.name)}
                          >
                            {here() ? "in circle ✓" : "recruit"}
                          </button>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </Show>

            <Show when={tab() === "memories"}>
              <div class="title-dex-cols camp-tally-mini">
                <div class="title-dex-col">
                  <p class="title-dex-cap">species read ({meta.dex.length})</p>
                  <Show when={meta.dex.length > 0} fallback={<p class="title-dex-none">— none yet —</p>}>
                    <For each={meta.dex}>{(d) => <p>{d.species} <span class="title-dex-dim">· {d.firstSeenStage}</span></p>}</For>
                  </Show>
                </div>
                <div class="title-dex-col">
                  <p class="title-dex-cap">memorial — memories ({meta.memories.length}/{FLASHBACKS.length})</p>
                  <div class="mem-gallery">
                    <For each={FLASHBACKS}>
                      {(fb, i) => (
                        <Show
                          when={hasMemory(meta, fb.id)}
                          fallback={
                            <div
                              class="mem-card locked"
                              classList={{ "is-sel": memSel() === i() }}
                              onClick={() => setMemSel(i())}
                            >
                              <p class="mem-card-locked">— {fb.title}: a memory not yet recovered —</p>
                            </div>
                          }
                        >
                          <div
                            class="mem-card is-open-able"
                            classList={{ "is-open": openMem() === fb.id, "is-sel": memSel() === i() }}
                            onClick={() => { setMemSel(i()); setOpenMem(openMem() === fb.id ? null : fb.id); }}
                          >
                            <pre class={openMem() === fb.id ? "mem-card-full" : "mem-card-art"}>
                              {openMem() === fb.id ? flashFull(FLASH_ART[fb.id]) : flashThumb(FLASH_ART[fb.id])}
                            </pre>
                            <p class="mem-card-title">{fb.title}</p>
                            <p class="title-dex-dim">{fb.caption}</p>
                            <p class="title-dex-dim">{openMem() === fb.id ? "enter / click to close" : "enter / click to view the whole memory"}</p>
                          </div>
                        </Show>
                      )}
                    </For>
                  </div>
                  <p class="title-dex-cap">the fallen ({meta.memorial.length})</p>
                  <Show when={meta.memorial.length > 0} fallback={<p class="title-dex-none">— none yet —</p>}>
                    <For each={meta.memorial}>{(m) => <p>{m.name} <span class="title-dex-dim">· {m.stage}</span></p>}</For>
                  </Show>
                </div>
              </div>
            </Show>
          </div>

          <p class="camp-dialog-hint">←/→ tabs · ↑/↓ + enter: memories · number: recruit / release · [Esc] back</p>
        </div>
      </Show>

      <Show when={inventoryOpen()}>
        <InventoryDialog run={props.run} onClose={() => setInventoryOpen(false)} />
      </Show>

      <Show when={mapOpen()}>
        <div class="camp-dialog camp-roster">
          <p class="camp-roster-head">THE LONG WALK SOUTH — the branches ahead</p>
          <div class="camp-tabpane const-pane">
            <div class="const-stage">
              <For each={constGrid()}>
                {(gridRow) => (
                  <div class="const-row">
                    <For each={gridRow}>{(cell) => <span class={cell.cls}>{cell.ch}</span>}</For>
                  </div>
                )}
              </For>
            </div>
            <p class="title-dex-cap const-chosen">
              ›{" "}
              {(() => {
                const r = reachable(props.route);
                if (r.length === 0) return "the road ends here";
                const n = r[Math.max(0, Math.min(r.length - 1, mapSel()))];
                return dangerWord(n);
              })()}
            </p>
            <p class="title-dex-dim const-legend">
              ✦ you · ✧ a road you may take (its mark is its south gate) ·
              ✶ the road already walked · ✺ the equator · ⋆ not yet
            </p>
          </div>
          <p class="camp-dialog-hint">↑↓←→ choose a road · enter / number: take it · [M] / [Esc] close</p>
        </div>
      </Show>

      {/* Bottom UI band (DESIGN.md §5 / Option B) — dedicated UI space below
          the map. Flavor / tribe status / gate list / hint stack here in
          normal flow; the map shrinks to fit above via container queries
          on .camp-stage-wrap. Hidden flavor when stages have none configured. */}
      <div class="camp-ui">
        <Show when={stageFlavor(props.run).length > 0}>
          <p class="camp-flavor">{stageFlavor(props.run)}</p>
        </Show>
        <p class="camp-status" classList={{ "is-low": tribeFelt(props.run.campIntegrity).low }}>
          {tribeFelt(props.run.campIntegrity).word}
          {tribeFelt(props.run.campIntegrity).low ? " — it can take little more" : ""}
        </p>
        <p class="camp-hint">arrows: walk · [1-9] take a south gate · [M] the long walk · the Cinder keeps the tally</p>
      </div>
    </div>
  );
}
