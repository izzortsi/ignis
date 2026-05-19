// The classic Doom (PSX) fire effect — a shared, pure module rendered by both
// the Solid intro Hearth and the in-game camp. Bottom row is a constant max-
// intensity source; each tick propagates upward with random decay + sideways
// wind, giving a living flame. Deterministic given an Rng (fits the seeded
// ethos, and makes it testable headless).

import type { Rng } from "../rng";

// 0 = cold/dead .. MAX = white-hot source. 37 levels like the PSX original.
export const FIRE_MAX = 36;

export interface DoomFire {
  w: number;
  h: number;
  cells: Uint8Array; // row-major, y=0 at top, y=h-1 the source row
}

export function makeDoomFire(w: number, h: number): DoomFire {
  const cells = new Uint8Array(w * h); // all 0 (cold)
  for (let x = 0; x < w; x++) cells[(h - 1) * w + x] = FIRE_MAX; // source row
  return { w, h, cells };
}

// One propagation tick. For each cell, carry the cell below it upward, losing
// a little intensity and drifting sideways by the wind roll (Doom's algorithm).
export function stepDoomFire(fire: DoomFire, rng: Rng): void {
  const { w, h, cells } = fire;
  for (let x = 0; x < w; x++) {
    for (let y = 1; y < h; y++) {
      const src = y * w + x;
      const intensity = cells[src];
      if (intensity === 0) {
        cells[src - w] = 0;
        continue;
      }
      const roll = rng.nextInt(3); // 0..2
      const decay = roll & 1; // 0 or 1
      let dstX = x - roll + 1; // wind drift -1..+1
      if (dstX < 0) dstX = 0;
      else if (dstX >= w) dstX = w - 1;
      cells[(y - 1) * w + dstX] = intensity - decay;
    }
  }
}

// Optionally let the source flicker (a dying Hearth is a low source). 1 = full.
export function setSource(fire: DoomFire, strength: number): void {
  const lvl = Math.max(0, Math.min(FIRE_MAX, Math.round(strength * FIRE_MAX)));
  const base = (fire.h - 1) * fire.w;
  for (let x = 0; x < fire.w; x++) fire.cells[base + x] = lvl;
}

// Seed only a centred band of the source row (the rest cold) so the fire
// rises as a tapering plume instead of filling the box as a solid block.
// `frac` is the fraction of the width that burns; `strength` 0..1 its level.
export function setSourceBand(fire: DoomFire, strength: number, frac: number): void {
  const lvl = Math.max(0, Math.min(FIRE_MAX, Math.round(strength * FIRE_MAX)));
  const bandW = Math.max(1, Math.round(fire.w * Math.max(0, Math.min(1, frac))));
  const x0 = Math.floor((fire.w - bandW) / 2);
  const base = (fire.h - 1) * fire.w;
  for (let x = 0; x < fire.w; x++) {
    fire.cells[base + x] = x >= x0 && x < x0 + bandW ? lvl : 0;
  }
}

export function intensityAt(fire: DoomFire, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= fire.w || y >= fire.h) return 0;
  return fire.cells[y * fire.w + x];
}

const GLYPH_RAMP = " .'^\":;irs023#%&@";

export function fireGlyph(level: number): string {
  if (level <= 0) return " ";
  const i = Math.min(GLYPH_RAMP.length - 1, 1 + Math.floor((level / FIRE_MAX) * (GLYPH_RAMP.length - 2)));
  return GLYPH_RAMP[i];
}

// Black -> deep red -> red -> orange -> amber -> yellow -> white. Returns a
// packed 0xRRGGBB number (same Color type as the screen/Palette).
const FIRE_STOPS: ReadonlyArray<readonly [number, number, number]> = [
  [7, 7, 7],
  [80, 12, 6],
  [150, 26, 10],
  [205, 60, 16],
  [235, 110, 30],
  [245, 170, 60],
  [250, 215, 120],
  [255, 245, 220],
];

export function fireColor(level: number): number {
  const t = Math.max(0, Math.min(1, level / FIRE_MAX));
  const seg = t * (FIRE_STOPS.length - 1);
  const i = Math.min(FIRE_STOPS.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = FIRE_STOPS[i];
  const b = FIRE_STOPS[i + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (bl & 0xff);
}
