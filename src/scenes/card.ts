// A Cinder card: a framed panel with the fire's name, rarity, its animated
// art (the 6-frame idle loop from petart), and its stats. Used by the Cinder
// view; the line builder is pure so it can be unit-tested.

import { Screen, Palette, type Color } from "../screen";
import { isAlive, isBurnBright, type Cinder } from "../core/cinder";
import { partsForName, stageForCinder, moodForCinder, type Rarity } from "../core/petart";
import { drawCinder } from "./draw";

export const RARITY_COLOR: Record<Rarity, Color> = {
  common: Palette.dim,
  uncommon: Palette.native,
  rare: Palette.mirror,
  legendary: Palette.ember,
};

const CW = 26; // card width
const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

export interface CardLines {
  name: string;
  rarity: Rarity;
  stats: string[];
}

// Pure: everything textual on the card. Testable without a Screen.
export function cinderCardLines(c: Cinder): CardLines {
  const parts = partsForName(c.name);
  const state = !isAlive(c) ? "guttered" : isBurnBright(c) ? "burn-bright" : "steady";
  const stats = [
    `stage    : ${stageForCinder(c)}`,
    `state    : ${state}`,
    `vitality : ${pct(c.vitality)}`,
    c.bonded ? `bond     : ${pct(c.bond)}` : "circle-fire (unbonded)",
    `manner   : ${c.manner}`,
    `spectral : ${c.spectral}`,
    `acuity   : ${pct(c.baseAcuity)}`,
  ];
  return { name: c.name, rarity: parts.rarity, stats };
}

function hline(screen: Screen, x: number, y: number): void {
  screen.text(x, y, "+" + "-".repeat(CW - 2) + "+", Palette.dim);
}

function vrow(screen: Screen, x: number, y: number, inner: string, col: Color): void {
  const body = inner.slice(0, CW - 4).padEnd(CW - 4);
  screen.text(x, y, "|", Palette.dim);
  screen.text(x + 2, y, body, col);
  screen.text(x + CW - 1, y, "|", Palette.dim);
}

// Draw the full card at (x,y). Height = 22 rows.
export function drawCinderCard(screen: Screen, x: number, y: number, c: Cinder, anim: number): void {
  const card = cinderCardLines(c);
  hline(screen, x, y);

  // Title row: name left, rarity right, on one line.
  const left = card.name.slice(0, 14);
  const right = card.rarity.toUpperCase();
  const gap = Math.max(1, CW - 4 - left.length - right.length);
  screen.text(x, y + 1, "|", Palette.dim);
  screen.text(x + 2, y + 1, left, Palette.text);
  screen.text(x + 2 + left.length + gap, y + 1, right, RARITY_COLOR[card.rarity]);
  screen.text(x + CW - 1, y + 1, "|", Palette.dim);
  hline(screen, x, y + 2);

  // Art: the 12x20 animated frame, framed by the card sides.
  for (let r = 0; r < 12; r++) {
    screen.text(x, y + 3 + r, "|", Palette.dim);
    screen.text(x + CW - 1, y + 3 + r, "|", Palette.dim);
  }
  drawCinder(screen, x + 3, y + 3, c, moodForCinder(c), anim);

  hline(screen, x, y + 15);
  for (let i = 0; i < card.stats.length; i++) {
    vrow(screen, x, y + 16 + i, card.stats[i], i === 1 ? Palette.text : Palette.dim);
  }
  hline(screen, x, y + 16 + card.stats.length);
}
