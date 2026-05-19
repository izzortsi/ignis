// Title menu: begin a run (through the Initiation Ritual) or open the Dex.
// The Dex/memorial persist across runs, so the title is also the trophy room.

import type { Input, Scene, SceneCmd } from "../scene";
import { Cmd } from "../scene";
import { Screen, Palette } from "../screen";
import { IntroScene } from "./intro";
import { DexScene } from "./dex";

export class TitleScene implements Scene {
  _t = 0;

  update(dt: number, input: Input): SceneCmd {
    this._t += dt;
    if (input.pressed.has("Escape")) return Cmd.quit;
    if (input.pressed.has("Enter") || input.pressed.has("n") || input.pressed.has("N")) {
      return Cmd.replace(new IntroScene());
    }
    if (input.pressed.has("d") || input.pressed.has("D")) return Cmd.replace(new DexScene());
    return Cmd.none;
  }

  render(screen: Screen): void {
    const midY = Math.floor(screen.rows / 2);
    screen.textCentered(midY - 4, "LUDUS  IGNIS", Palette.ember);
    screen.textCentered(midY - 2, "a roguelite of fire, chirality, and the long walk south", Palette.dim);

    const glyphs = [".", ":", "*", "o", "*", ":"];
    const g = glyphs[Math.floor(this._t * 6) % glyphs.length];
    screen.textCentered(midY, g, Palette.ember);

    screen.textCentered(screen.rows - 4, "[Enter] begin the rite and the walk south", Palette.text);
    screen.textCentered(screen.rows - 3, "[D] the Dex — what you have catalogued", Palette.native);
    screen.textCentered(screen.rows - 2, "[Esc] quit", Palette.dim);
  }
}
