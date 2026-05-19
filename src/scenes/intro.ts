// The Initiation Ritual (bible §9), English-first. Prose ported from the
// original ludus-ignis introduction, with the probability-tutor framing of
// the prelude rewritten out (iteration 7 — no teaching). Visuals are plain
// ASCII pictograms, not the original unicode scene-art. Naming your Cinder
// seeds the whole run. [Esc] skips with a suggested name.

import type { Input, Scene, SceneCmd } from "../scene";
import { Cmd } from "../scene";
import { Screen, Palette } from "../screen";
import { startRun } from "../core/run";
import { Rng } from "../rng";
import { RunScene } from "./run";
import { drawFire } from "./draw";
import { RIO_MIYAKE, MIRROR_LEAK, fitArt } from "./sceneart";

const ART_W = 80;
const ART_H = 20;

// Bible §9 fallback name pool (English-first).
const POOL = ["Kel", "Ash", "Mira", "Theo", "Wren", "Suri", "Tova"];

// ASCII pictograms (no unicode) shown above a beat's text.
const PICTO: Record<string, string[]> = {
  __FIRE__: [
    "   (  )",
    "  (    )",
    "   )  (",
    "  /\\/\\/\\",
  ],
  __HEARTH__: [
    "       (  )",
    "      (    )",
    "     ( )  ( )",
    "      ))((",
    "     /======\\",
    "     \\______/",
  ],
  __TRIBE__: [
    "  o   o   o",
    " /|\\ /|\\ /|\\",
    " / \\ / \\ / \\",
    "     /==\\",
    "     \\__/",
  ],
  __EMBER__: [
    "       *",
    "      (o)",
    "     \\___/",
    "      |_|",
  ],
};

// Each beat: an optional pictogram marker as line 0, then text lines.
// __NAME__ is the special naming beat.
const BEATS: string[][] = [
  ["__FIRE__", "Listen. The fire is good tonight.", "Pull the hide closer."],
  ["__CME__", "The Sun turned against the Age of Men —", "it loosed the green serpent across the sky."],
  ["__LEAK__", "What the Sun could not take, the mirror took.", "Nothing of the wrong hand may be eaten, drunk, or touched."],
  ["You had the strangest dream...", "and today, today is the Day of the Ritual."],
  ["__TRIBE__", "The Tender takes you to the Elder Fire.", "The tribe gathers. The dance begins."],
  ["__HEARTH__", "Come closer. Sit. The fire listens."],
  ["__HEARTH__", "There was an Age of Men. They were many.", "They built with steel, and the sky was a friend."],
  ["__HEARTH__", "But the Sun turned against them. It loosed the green", "serpent — and it still turns up there, where you can see."],
  ["__HEARTH__", "The cities went silent. The great waters", "swallowed what was left. The ancients died."],
  ["__HEARTH__", "We are the ones who stayed. Few, beneath the serpent."],
  ["__HEARTH__", "The fire is what remains to us of the ancients.", "Today, you receive yours."],
  ["__EMBER__", "The Tender draws an ember toward your vessel.", "The ember passes."],
  ["Wake."],
  ["__NAME__"],
  ["Morning. You wake alone beside it.", "", "The long walk south begins."],
];

export class IntroScene implements Scene {
  idx = 0;
  buffer = "";
  suggested: string;
  chosen = "";
  anim = 0;
  // The real ludus-ignis dense flashbacks, copied verbatim, fit to the grid.
  cme = fitArt(RIO_MIYAKE, ART_W, ART_H);
  leak = fitArt(MIRROR_LEAK, ART_W, ART_H);

  constructor() {
    const r = new Rng(BigInt(Date.now()) ^ 0x9e3779b97f4a7c15n);
    this.suggested = POOL[r.nextInt(POOL.length)];
  }

  private isName(): boolean {
    return BEATS[this.idx][0] === "__NAME__";
  }

  private begin(name: string): SceneCmd {
    return Cmd.replace(new RunScene(startRun(name)));
  }

  update(dt: number, input: Input): SceneCmd {
    this.anim += dt;
    if (input.pressed.has("Escape")) return this.begin(this.suggested);

    if (this.isName()) {
      for (const k of input.pressed) {
        if (k === "Backspace") this.buffer = this.buffer.slice(0, -1);
        else if (k === "Enter") {
          this.chosen = this.buffer.trim() || this.suggested;
          this.idx += 1; // -> final beat
        } else if (k.length === 1 && /[A-Za-z0-9 \-']/.test(k) && this.buffer.length < 18) {
          this.buffer += k;
        }
      }
      return Cmd.none;
    }

    if (input.pressed.has("Enter") || input.pressed.has(" ")) {
      if (this.idx >= BEATS.length - 1) return this.begin(this.chosen || this.suggested);
      this.idx += 1;
    }
    return Cmd.none;
  }

  render(screen: Screen): void {
    const beat = BEATS[this.idx];
    const midY = Math.floor(screen.rows / 2);

    if (this.isName()) {
      const shown = this.buffer.length > 0 ? this.buffer : this.suggested;
      // The just-kindled Cinder, alive and reacting to the name you give it.
      drawFire(screen, Math.floor((screen.cols - 20) / 2), 2, shown, "spark", "idle", this.anim);
      screen.textCentered(midY - 4, "The ember catches in your vessel.", Palette.ember);
      screen.textCentered(midY - 1, "Name your Cinder:", Palette.text);
      const dim = this.buffer.length === 0;
      screen.textCentered(midY + 1, "> " + shown + (dim ? "" : "_"), dim ? Palette.dim : Palette.ember);
      screen.textCentered(midY + 4, "type a name, or [Enter] to accept the suggested one", Palette.dim);
      screen.textCentered(screen.rows - 2, "the name you give seeds the road ahead", Palette.dim);
      return;
    }

    if (beat[0] === "__CME__" || beat[0] === "__LEAK__") {
      const art = beat[0] === "__CME__" ? this.cme : this.leak;
      const ax = Math.max(0, Math.floor((screen.cols - ART_W) / 2));
      for (let i = 0; i < art.length; i++) screen.text(ax, 1 + i, art[i], Palette.mirror);
      for (let i = 1; i < beat.length; i++) {
        screen.textCentered(2 + art.length + i, beat[i], i === 1 ? Palette.ember : Palette.text);
      }
      screen.textCentered(screen.rows - 2, "[Space] go on   ·   [Esc] skip the rite", Palette.dim);
      return;
    }

    const picto = PICTO[beat[0]];
    if (picto !== undefined) {
      const top = midY - picto.length - 2;
      for (let i = 0; i < picto.length; i++) screen.textCentered(top + i, picto[i], Palette.ember);
      for (let i = 1; i < beat.length; i++) screen.textCentered(midY + i, beat[i], Palette.text);
    } else {
      const top = midY - Math.floor(beat.length / 2);
      for (let i = 0; i < beat.length; i++) {
        screen.textCentered(top + i, beat[i], i === 0 && beat.length > 1 ? Palette.ember : Palette.text);
      }
    }
    screen.textCentered(screen.rows - 2, "[Space] go on   ·   [Esc] skip the rite", Palette.dim);
  }
}
