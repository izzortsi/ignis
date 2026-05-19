// The run scene = the overworld route map (DESIGN.md map layer 1) plus the
// orchestrator. The player descends a south-flowing node graph, choosing a
// path; each node resolves by kind (tide -> the Tide scene, camp -> tend
// fires, forage/ruin -> spoils, end -> the equator). Replaces blind travel.

import type { Input, Scene, SceneCmd } from "../scene";
import { Cmd } from "../scene";
import { Screen, Palette, PLAYER, type Color } from "../screen";
import {
  startRun,
  randomRunName,
  setStage,
  arriveAtEquator,
  currentStage,
  applySpoils,
  type RunState,
} from "../core/run";
import { isAlive, isBurnBright } from "../core/cinder";
import { moodForCinder } from "../core/petart";
import { drawCinder } from "./draw";
import {
  makeRoute,
  currentNode,
  reachable,
  moveTo,
  stageOf,
  type RouteMap,
  type NodeKind,
} from "../core/routemap";
import { LocalMapScene } from "./localmap";
import { CinderCardScene } from "./cinder";
import { TitleScene } from "./title";

const GLYPH: Record<NodeKind, string> = {
  start: "o",
  leg: "+",
  end: "*",
};
function legLabel(n: { kind: NodeKind; danger: number }): string {
  if (n.kind === "start") return "trailhead";
  if (n.kind === "end") return "the equator";
  const d = n.danger;
  const w = d < 0.33 ? "low" : d < 0.6 ? "uneasy" : d < 0.82 ? "hard" : "grim";
  return `a leg south (danger: ${w})`;
}

function bar(s: Screen, x: number, y: number, w: number, frac: number, fg: Color, label: string): void {
  const filled = Math.round(Math.max(0, Math.min(1, frac)) * w);
  s.text(x, y, label, Palette.dim);
  const bx = x + label.length + 1;
  s.put(bx, y, "[", Palette.dim);
  for (let i = 0; i < w; i++) s.put(bx + 1 + i, y, i < filled ? "#" : "-", i < filled ? fg : Palette.dim);
  s.put(bx + 1 + w, y, "]", Palette.dim);
}

export class RunScene implements Scene {
  run: RunState;
  route: RouteMap;
  resolved = new Set<number>();
  message = "The trail drops south. Choose your path.";
  anim = 0;

  constructor(run?: RunState) {
    this.run = run ?? startRun(randomRunName());
    this.route = makeRoute(this.run.runName);
  }

  private resolveCurrent(): SceneCmd {
    const run = this.run;
    const cur = currentNode(this.route);
    this.resolved.add(cur.id);
    setStage(run, stageOf(cur));

    if (cur.kind === "start") {
      this.message = "The trail drops south. Choose your path.";
      return Cmd.none;
    }
    if (cur.kind === "end") {
      arriveAtEquator(run);
      this.message = "The tribe reaches the equator.";
      return Cmd.none;
    }
    // Every other node opens its walkable chapada (the local map).
    this.message = "Choose your path onward.";
    return Cmd.push(new LocalMapScene(run, cur));
  }

  update(dt: number, input: Input): SceneCmd {
    const run = this.run;
    this.anim += dt;
    if (run.phase === "ended") {
      if (input.pressed.has("Enter")) return Cmd.replace(new TitleScene());
      return Cmd.none;
    }
    if (input.pressed.has("Escape")) return Cmd.replace(new TitleScene());
    if (input.pressed.has("c") || input.pressed.has("C")) {
      return Cmd.push(new CinderCardScene(this.run, 0));
    }

    const cur = currentNode(this.route);
    if (!this.resolved.has(cur.id)) return this.resolveCurrent();
    if (run.outcome !== "running") return Cmd.none; // resolveCurrent may have ended it

    // Current node consumed: pick an onward path by number key.
    const opts = reachable(this.route);
    for (let i = 0; i < opts.length && i < 9; i++) {
      if (input.pressed.has(String(i + 1))) {
        applySpoils(run, { provisions: -0.04 }); // the long walk costs stores
        moveTo(this.route, opts[i].id);
        break;
      }
    }
    return Cmd.none;
  }

  render(screen: Screen): void {
    const run = this.run;
    screen.textCentered(0, "IGNIS — the long walk south", Palette.ember);

    if (run.phase === "ended") {
      const won = run.outcome === "arrived";
      screen.textCentered(14, won ? "THE TRIBE REACHES THE EQUATOR" : "THE TRIBE IS LOST", won ? Palette.native : Palette.danger);
      screen.textCentered(16, `Dex ${run.meta.dex.length}   Memorial ${run.meta.memorial.length}`, Palette.text);
      screen.textCentered(18, "(dex and memorial carry to the next run)", Palette.dim);
      screen.textCentered(screen.rows - 2, "[Enter] return to the fire", Palette.dim);
      return;
    }

    const cur = currentNode(this.route);
    const reach = new Set(cur.next);
    const reachList = cur.next;

    // --- the graph (north at top, equator at bottom) ---
    const baseX = 4;
    const slot = 8;
    for (let r = 0; r < this.route.ranks; r++) {
      const y = 3 + r * 2;
      const ids = this.route.byRank[r];
      for (let c = 0; c < ids.length; c++) {
        const n = this.route.nodes[ids[c]];
        const x = baseX + c * slot;
        const isCur = n.id === cur.id;
        const isReach = reach.has(n.id);
        const ch = isCur ? PLAYER.ch : GLYPH[n.kind];
        const col = isCur
          ? Palette.ember
          : isReach
            ? Palette.native
            : this.resolved.has(n.id)
              ? Palette.dim
              : Palette.text;
        screen.put(x, y, ch, col);
        if (isReach) screen.put(x - 2, y, String(reachList.indexOf(n.id) + 1), Palette.native);
        if (r < this.route.ranks - 1) {
          for (const tid of n.next) {
            const tn = this.route.nodes[tid];
            const tx = baseX + tn.col * slot;
            const cc = tx === x ? "|" : tx > x ? "\\" : "/";
            screen.put(Math.round((x + tx) / 2), y + 1, cc, Palette.dim);
          }
        }
      }
    }

    // --- side panel ---
    const px = 56;
    screen.text(px, 3, `Stage ${run.stageIndex + 1}/8`, Palette.text);
    screen.text(px, 4, currentStage(run), Palette.dim);
    bar(screen, px, 6, 22, run.campIntegrity, run.campIntegrity > 0.4 ? Palette.native : Palette.danger, "camp  ");
    bar(screen, px, 7, 22, run.provisions, Palette.warn, "stores");

    // The bonded Cinder, rendered as its living self.
    const bonded = run.circle[0];
    drawCinder(screen, px + 10, 9, bonded, moodForCinder(bonded), this.anim);
    const bcol = !isAlive(bonded) ? Palette.danger : isBurnBright(bonded) ? Palette.ember : Palette.text;
    const bst = isBurnBright(bonded) ? "burn-bright" : `vit ${Math.round(bonded.vitality * 100)}%`;
    screen.text(px, 21, `${bonded.name} — ${bst}`, bcol);

    screen.text(px, 23, "The Circle:", Palette.dim);
    for (let i = 0; i < run.circle.length && i < 6; i++) {
      const c = run.circle[i];
      const col = !isAlive(c) ? Palette.danger : isBurnBright(c) ? Palette.ember : Palette.text;
      const st = isBurnBright(c) ? "bright" : `${Math.round(c.vitality * 100)}%`;
      screen.text(px, 24 + i, `${c.bonded ? "*" : " "} ${c.name}  ${st}`, col);
    }

    // --- message + onward options ---
    screen.text(4, screen.rows - 6, this.message, Palette.text);
    if (this.resolved.has(cur.id)) {
      const opts = reachable(this.route);
      let line = "";
      for (let i = 0; i < opts.length; i++) line += `[${i + 1}] ${legLabel(opts[i])}    `;
      screen.text(4, screen.rows - 4, line.trim(), Palette.native);
    }
    screen.textCentered(screen.rows - 2, "press a number to take that path   ·   [Esc] abandon", Palette.dim);
  }
}
