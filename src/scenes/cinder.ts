// The Cinder view: a full card for one fire in the circle. Left/Right flip
// through the circle (the bonded fire is first). Esc returns.

import type { Input, Scene, SceneCmd } from "../scene";
import { Cmd } from "../scene";
import { Screen, Palette } from "../screen";
import type { RunState } from "../core/run";
import { drawCinderCard } from "./card";

export class CinderCardScene implements Scene {
  run: RunState;
  idx: number;
  anim = 0;

  constructor(run: RunState, idx = 0) {
    this.run = run;
    this.idx = idx;
  }

  update(dt: number, input: Input): SceneCmd {
    this.anim += dt;
    const n = this.run.circle.length;
    if (input.pressed.has("Escape") || input.pressed.has("Enter")) return Cmd.pop;
    if (input.pressed.has("ArrowRight")) this.idx = (this.idx + 1) % n;
    if (input.pressed.has("ArrowLeft")) this.idx = (this.idx - 1 + n) % n;
    return Cmd.none;
  }

  render(screen: Screen): void {
    const n = this.run.circle.length;
    const i = Math.max(0, Math.min(this.idx, n - 1));
    screen.textCentered(1, "THE  CINDER", Palette.ember);
    const x = Math.floor((screen.cols - 26) / 2);
    drawCinderCard(screen, x, 4, this.run.circle[i], this.anim);
    screen.textCentered(28, `${i + 1} / ${n}   the circle`, Palette.dim);
    screen.textCentered(screen.rows - 2, "[<-/->] flip through the circle   ·   [Esc] back", Palette.dim);
  }
}
