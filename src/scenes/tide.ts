// The Tide Defense scene: the player reads each incoming entity with the
// bonded fire (R, repeatable -> a joint Reading), then decides its fate
// (E pass / B burn / Q quarantine). The truth is never shown — only the
// camp bar shifts as consequences land. On the last entity the encounter
// reports its outcome to the run and pops back.

import type { Input, Scene, SceneCmd } from "../scene";
import { Cmd } from "../scene";
import { Screen, Palette, type Color } from "../screen";
import { bandMeaning } from "../core/reading";
import { bondedCinder, applyEncounterOutcome, currentStage, type RunState } from "../core/run";
import {
  makeEncounter,
  current,
  readCurrent,
  decide,
  tideOutcome,
  type TideEncounter,
} from "../core/tide";
import { speciesByName } from "../core/bestiary";
import { critterSprite } from "../core/critterart";

function bar(screen: Screen, x: number, y: number, w: number, frac: number, fg: Color, label: string): void {
  const filled = Math.round(Math.max(0, Math.min(1, frac)) * w);
  screen.text(x, y, label, Palette.dim);
  const bx = x + label.length + 1;
  screen.put(bx, y, "[", Palette.dim);
  for (let i = 0; i < w; i++) screen.put(bx + 1 + i, y, i < filled ? "#" : "-", i < filled ? fg : Palette.dim);
  screen.put(bx + 1 + w, y, "]", Palette.dim);
}

export class TideScene implements Scene {
  run: RunState;
  tide: TideEncounter;
  lastBands: string[] = [];

  constructor(run: RunState) {
    this.run = run;
    this.tide = makeEncounter(run);
  }

  private finishIfDone(): SceneCmd {
    if (this.tide.finished) {
      applyEncounterOutcome(this.run, tideOutcome(this.tide));
      return Cmd.pop;
    }
    return Cmd.none;
  }

  update(_dt: number, input: Input): SceneCmd {
    const t = this.tide;
    if (t.finished) return this.finishIfDone();
    const ent = current(t);
    if (ent === undefined) {
      t.finished = true;
      return this.finishIfDone();
    }

    if (input.pressed.has("r") || input.pressed.has("R")) {
      const band = readCurrent(t, this.run, bondedCinder(this.run));
      this.lastBands.push(band);
    }
    let acted = false;
    if (input.pressed.has("e") || input.pressed.has("E")) {
      decide(t, this.run, "pass");
      acted = true;
    } else if (input.pressed.has("b") || input.pressed.has("B")) {
      decide(t, this.run, "burn");
      acted = true;
    } else if (input.pressed.has("q") || input.pressed.has("Q")) {
      decide(t, this.run, "quarantine");
      acted = true;
    }
    if (acted) {
      this.lastBands = [];
      return this.finishIfDone();
    }
    return Cmd.none;
  }

  render(screen: Screen): void {
    const t = this.tide;
    const run = this.run;
    screen.textCentered(1, "AN  ENCOUNTER", Palette.mirror);
    screen.text(4, 3, `${currentStage(run)} — something crosses your path`, Palette.dim);

    const previewIntegrity = Math.max(0, run.campIntegrity - t.campDamage);
    bar(screen, 4, 5, 30, previewIntegrity, previewIntegrity > 0.4 ? Palette.native : Palette.danger, "camp ");

    const ent = current(t);
    if (ent !== undefined) {
      screen.text(4, 9, "Brought to the fire:", Palette.dim);
      screen.text(6, 11, `${ent.species}`, Palette.text);
      screen.text(6, 12, `a sample of ${ent.sample}`, Palette.dim);

      // The creature itself — neutral colour so its class isn't given away
      // (the fire's Reading is still the only chirality tell).
      const sp = speciesByName(ent.species);
      if (sp !== undefined) {
        const art = critterSprite(sp);
        for (let r = 0; r < art.length; r++) screen.text(46, 7 + r, art[r], Palette.text);
      }

      screen.text(4, 15, "The fire says:", Palette.dim);
      if (this.lastBands.length === 0) {
        screen.text(6, 16, "— (press R to read it) —", Palette.dim);
      } else {
        for (let i = 0; i < this.lastBands.length; i++) {
          const tagged = i === this.lastBands.length - 1;
          screen.text(
            6,
            16 + i,
            (tagged ? "» " : "  ") + bandMeaning(this.lastBands[i] as never),
            tagged ? Palette.ember : Palette.dim,
          );
        }
      }
    }

    screen.textCentered(screen.rows - 3, "[R] read again (joint)    [E] let pass    [B] burn    [Q] quarantine", Palette.text);
    screen.textCentered(screen.rows - 2, "the fire never speaks in numbers — weigh it yourself", Palette.dim);
  }
}
