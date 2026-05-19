// The Dex (DESIGN.md §10) — the collection screen, two tabs:
//  - SPECIES: the bestiary cross-referenced against what you've read correctly.
//  - FIRES:   the wild fires you've caught in duels, each shown as its card.
// Both persist across runs (run.meta). [Tab] switches; in FIRES, <-/-> flips.

import type { Input, Scene, SceneCmd } from "../scene";
import { Cmd } from "../scene";
import { Screen, Palette, type Color } from "../screen";
import { BESTIARY, speciesByClass } from "../core/bestiary";
import { loadMeta } from "../core/run";
import { kindle } from "../core/cinder";
import type { Truth } from "../core/reading";
import { drawCinderCard } from "./card";
import { TitleScene } from "./title";

const CLASS_COL: Record<Truth, Color> = {
  mirror: Palette.mirror,
  native: Palette.native,
  inert: Palette.dim,
};

type Tab = "species" | "fires";

export class DexScene implements Scene {
  tab: Tab = "species";
  idx = 0;
  anim = 0;

  update(dt: number, input: Input): SceneCmd {
    this.anim += dt;
    if (input.pressed.has("Escape") || input.pressed.has("Enter")) {
      return Cmd.replace(new TitleScene());
    }
    if (input.pressed.has("Tab") || input.pressed.has("f") || input.pressed.has("F") || input.pressed.has("s") || input.pressed.has("S")) {
      this.tab = this.tab === "species" ? "fires" : "species";
      this.idx = 0;
    }
    if (this.tab === "fires") {
      const n = loadMeta().caught.length;
      if (n > 0) {
        if (input.pressed.has("ArrowRight")) this.idx = (this.idx + 1) % n;
        if (input.pressed.has("ArrowLeft")) this.idx = (this.idx - 1 + n) % n;
      }
    }
    return Cmd.none;
  }

  render(screen: Screen): void {
    const meta = loadMeta();
    screen.textCentered(1, "THE  DEX", Palette.ember);
    const sp = this.tab === "species";
    screen.textCentered(
      2,
      `${sp ? "[ SPECIES ]" : "  species  "}    ${sp ? "  fires  " : "[ FIRES ]"}`,
      Palette.dim,
    );

    if (this.tab === "species") {
      const seen = new Set(meta.dex.map((d) => d.species));
      screen.textCentered(3, `${[...seen].filter((n) => BESTIARY.some((s) => s.name === n)).length}/${BESTIARY.length} catalogued`, Palette.dim);
      let y = 5;
      for (const c of ["mirror", "native", "inert"] as Truth[]) {
        screen.text(4, y, c.toUpperCase(), CLASS_COL[c]);
        y += 1;
        for (const s of speciesByClass(c)) {
          if (seen.has(s.name)) screen.text(6, y, `${s.name} — ${s.look}`, CLASS_COL[c]);
          else screen.text(6, y, "????? — undiscovered", Palette.dim);
          y += 1;
        }
        y += 1;
      }
      const extra = meta.dex.filter((d) => !BESTIARY.some((s) => s.name === d.species));
      if (extra.length > 0) {
        screen.text(46, 5, "OTHER FINDS", Palette.warn);
        for (let i = 0; i < extra.length && i < 24; i++) {
          screen.text(48, 6 + i, `${extra[i].species} (${extra[i].firstSeenStage})`, Palette.dim);
        }
      }
      screen.textCentered(screen.rows - 2, "[Tab] caught fires   ·   [Esc] back", Palette.dim);
      return;
    }

    // FIRES tab — caught wild fires, one card at a time.
    const caught = meta.caught;
    if (caught.length === 0) {
      screen.textCentered(14, "No fires caught yet.", Palette.dim);
      screen.textCentered(16, "Win a Cinder Duel against a wild pattern to catch one.", Palette.dim);
      screen.textCentered(screen.rows - 2, "[Tab] species   ·   [Esc] back", Palette.dim);
      return;
    }
    const i = Math.max(0, Math.min(this.idx, caught.length - 1));
    const entry = caught[i];
    // Identity is name-deterministic — rebuild the fire to show its true card.
    const fire = kindle(entry.name, false);
    const x = Math.floor((screen.cols - 26) / 2);
    drawCinderCard(screen, x, 4, fire, this.anim);
    screen.textCentered(28, `caught at ${entry.stage}    ·    ${i + 1} / ${caught.length}`, Palette.dim);
    screen.textCentered(screen.rows - 2, "[<-/->] flip   ·   [Tab] species   ·   [Esc] back", Palette.dim);
  }
}
