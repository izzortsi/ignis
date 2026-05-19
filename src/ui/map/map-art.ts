// Top-down camp map — the Elder Fire sits on top of a tableland (chapada),
// an oval plateau in the middle of the canvas. Beyond the cliff edges is
// open sky, with the green spiral aurora swirling overhead and stars
// scattered through the rest of the sky. The Apprentice walks only on the
// plateau interior; the cliff edges are non-walkable (would fall off).

import { mulberry32 } from '../ascii/prng';
import type { SceneDims } from '../intro/scene-art';

export const MAP_DIMS: SceneDims = { cols: 60, rows: 54, rowPx: 14 };
export const FRAMES = 15;
export const AURORA_FRAMES_COUNT = 60;
const M_COLS = MAP_DIMS.cols;
const M_ROWS = MAP_DIMS.rows;

// === PLATEAU SHAPE ===
// Tableland centred in the canvas, base ellipse radii perturbed by a sum
// of sine waves keyed off the polar angle. The waves give the boundary
// natural-looking bulges and inlets without hand-drawing a silhouette;
// changing the phase offsets reshuffles the irregularities.
// Centre pulled below the canvas mid-line so the upper sky band gets
// noticeably more breathing room than the void below the plateau —
// reads as "looking out across a high tableland with the night sky
// stretched overhead".
const PLATEAU_CENTER_ROW = 33;
const PLATEAU_CENTER_COL = Math.floor(M_COLS / 2);  // 30
const PLATEAU_SEMI_V     = 17;                       // vertical half-axis
const PLATEAU_SEMI_H     = 25;                       // horizontal half-axis

function plateauRadiusFactor(angle: number): number {
  // Multiplicative noise: 1.0 = no change, <1 = inlet, >1 = bulge.
  // Three octaves at decreasing amplitude give large bulges + small wobble.
  return 1.0
    + 0.10 * Math.sin(angle * 2.0 + 0.4)
    + 0.06 * Math.sin(angle * 5.0 + 1.7)
    + 0.04 * Math.sin(angle * 11.0 + 0.9);
}

function isOnPlateau(r: number, c: number): boolean {
  const dy = r - PLATEAU_CENTER_ROW;
  const dx = c - PLATEAU_CENTER_COL;
  if (dy === 0 && dx === 0) return true;
  const angle = Math.atan2(dy, dx);
  const k = plateauRadiusFactor(angle);
  const dr = dy / (PLATEAU_SEMI_V * k);
  const dc = dx / (PLATEAU_SEMI_H * k);
  return dr * dr + dc * dc < 1.0;
}

function isPlateauEdge(r: number, c: number): boolean {
  if (!isOnPlateau(r, c)) return false;
  return !isOnPlateau(r - 1, c) || !isOnPlateau(r + 1, c)
      || !isOnPlateau(r, c - 1) || !isOnPlateau(r, c + 1);
}

// Horizon: a single global row = the plateau's topmost row anywhere.
// Stars and aurora only render at sky cells STRICTLY above this row,
// so the side strips and the bottom of the canvas stay empty (no stars
// below the horizon line).
const HORIZON_ROW: number = (() => {
  for (let r = 0; r < M_ROWS; r++) {
    for (let c = 0; c < M_COLS; c++) {
      if (isOnPlateau(r, c)) return r;
    }
  }
  return M_ROWS;
})();

function isAboveHorizon(r: number, _c: number): boolean {
  return r < HORIZON_ROW;
}

// === HEARTH (Elder Fire) ===
// Side-on visual on top-down map (a common convention — top-down "real"
// fire reads as a hot dot, but a side-view fire reads as a fire). 8 rows
// of doom-fire flames rise above a 2-row stone pit.

const HEARTH_FIRE_ROWS = 8;
const HEARTH_FIRE_COLS = 13;
const HEARTH_FIRE_TOP  = 14;                                // top row of flames
const HEARTH_FIRE_LEFT = 24;                                // left col of flames
const HEARTH_PIT_ROW   = HEARTH_FIRE_TOP + HEARTH_FIRE_ROWS; // row 22

const HEARTH_PIT_ART = [
  ' .ooOoOoOoOo. ',
  '  `         `  '
];
const HEARTH_PIT_LEFT = HEARTH_FIRE_LEFT - 1; // pit slightly wider than fire

// === CINDER (Apprentice's small personal vessel) ===

const CINDER_FIRE_ROWS = 3;
const CINDER_FIRE_COLS = 5;
const CINDER_FIRE_TOP  = 34;
const CINDER_FIRE_LEFT = 28;
const CINDER_VESSEL_ROW = CINDER_FIRE_TOP + CINDER_FIRE_ROWS; // row 37

const CINDER_VESSEL_ART = [
  '[___]',
  ' \\_/ '
];
const CINDER_VESSEL_LEFT = CINDER_FIRE_LEFT;

// === HIT BOXES + APPROACH CELLS ===
// Tap hit-boxes cover the full visible footprint (fire + base) plus a 1-cell
// halo so taps near the fire still register. Approach cells are immediately
// south of each interactable.

export const HEARTH_BOX = {
  rowMin: HEARTH_FIRE_TOP - 1,
  rowMax: HEARTH_PIT_ROW + 1,
  colMin: HEARTH_PIT_LEFT - 1,
  colMax: HEARTH_PIT_LEFT + HEARTH_PIT_ART[0].length
};
export const CINDER_BOX = {
  rowMin: CINDER_FIRE_TOP - 1,
  rowMax: CINDER_VESSEL_ROW + 1,
  colMin: CINDER_VESSEL_LEFT - 1,
  colMax: CINDER_VESSEL_LEFT + CINDER_VESSEL_ART[0].length
};
export const HEARTH_APPROACH = {
  row: HEARTH_BOX.rowMax + 1,
  col: HEARTH_FIRE_LEFT + Math.floor(HEARTH_FIRE_COLS / 2)
};
export const CINDER_APPROACH = {
  row: CINDER_BOX.rowMax + 1,
  col: CINDER_FIRE_LEFT + Math.floor(CINDER_FIRE_COLS / 2)
};

// First-run spawn: just left of the Cinder approach.
export const APPRENTICE_SPAWN = {
  row: CINDER_APPROACH.row,
  col: CINDER_APPROACH.col - 3
};

// === TERRAIN ===
// Static layer: tree perimeter + grass texture + Hearth pit + Cinder vessel.
// The animated fire glyphs render on a separate layer above this.

function blank(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(' '));
}

function placeBlock(grid: string[][], block: string[], row: number, col: number): void {
  for (let r = 0; r < block.length; r++) {
    const dest = row + r;
    if (dest < 0 || dest >= grid.length) continue;
    for (let c = 0; c < block[r].length; c++) {
      const dc = col + c;
      if (dc < 0 || dc >= grid[0].length) continue;
      const ch = block[r][c];
      if (ch !== ' ') grid[dest][dc] = ch;
    }
  }
}

function buildTerrain(): string[] {
  const grid = blank(M_ROWS, M_COLS);
  const rng = mulberry32(101);

  for (let r = 0; r < M_ROWS; r++) {
    for (let c = 0; c < M_COLS; c++) {
      if (!isOnPlateau(r, c)) continue;  // sky cell — leave blank for aurora layer
      if (isPlateauEdge(r, c)) {
        grid[r][c] = '^';                // cliff edge (non-walkable rock face)
      } else {
        // Plateau interior: sparse grass texture
        const x = rng();
        if (x < 0.04) grid[r][c] = ',';
        else if (x < 0.07) grid[r][c] = '\'';
        // else leave blank (still part of the plateau, just empty grass)
      }
    }
  }

  // Hearth stone pit + Cinder bronze vessel sit on the plateau interior
  placeBlock(grid, HEARTH_PIT_ART, HEARTH_PIT_ROW, HEARTH_PIT_LEFT);
  placeBlock(grid, CINDER_VESSEL_ART, CINDER_VESSEL_ROW, CINDER_VESSEL_LEFT);

  return grid.map((row) => row.join(''));
}

export const TERRAIN: string[] = buildTerrain();

// === SCREE (cliff-face / rock-debris border, below horizon) ===
// In the sky region BELOW the horizon, dust the cells near the plateau
// with rocky texture that thins out with distance — reads as the cliff
// face crumbling into scree at the base of the tableland. Cells far
// from the plateau stay blank (deep void). Cells above horizon are
// reserved for stars/aurora, so this layer skips them.

function distanceToPlateau(r: number, c: number, maxR: number): number {
  let best = maxR + 1;
  for (let dr = -maxR; dr <= maxR; dr++) {
    const r2 = r + dr;
    if (r2 < 0 || r2 >= M_ROWS) continue;
    for (let dc = -maxR; dc <= maxR; dc++) {
      const c2 = c + dc;
      if (c2 < 0 || c2 >= M_COLS) continue;
      if (!isOnPlateau(r2, c2)) continue;
      const d = Math.max(Math.abs(dr), Math.abs(dc));
      if (d < best) best = d;
    }
  }
  return best;
}

export const CLIFF_SCREE: string = (() => {
  const grid = blank(M_ROWS, M_COLS);
  const rng = mulberry32(73);
  const SCREE_REACH = 6;
  for (let r = 0; r < M_ROWS; r++) {
    for (let c = 0; c < M_COLS; c++) {
      if (isOnPlateau(r, c)) continue;
      if (isAboveHorizon(r, c)) continue;
      const d = distanceToPlateau(r, c, SCREE_REACH);
      if (d > SCREE_REACH) continue;
      const x = rng();
      if (d === 1) {
        // Right at the cliff foot — densest rocky band.
        if      (x < 0.45) grid[r][c] = ':';
        else if (x < 0.70) grid[r][c] = "'";
        else if (x < 0.85) grid[r][c] = ',';
      } else if (d === 2) {
        if      (x < 0.30) grid[r][c] = "'";
        else if (x < 0.50) grid[r][c] = ',';
        else if (x < 0.60) grid[r][c] = '.';
      } else if (d <= 4) {
        if      (x < 0.18) grid[r][c] = ',';
        else if (x < 0.30) grid[r][c] = '.';
      } else {
        if (x < 0.08) grid[r][c] = '.';
      }
    }
  }
  return grid.map((row) => row.join('')).join('\n');
})();

// === STARS (sky background, above horizon only) ===
// Sparse stars scattered only through sky cells ABOVE the plateau's top
// edge in each column — nothing below the horizon (the foreground would
// be lower terrain at night, no visible sky there).
export const STARS_FIELD: string = (() => {
  const grid = blank(M_ROWS, M_COLS);
  const rng = mulberry32(42);
  for (let r = 0; r < M_ROWS; r++) {
    for (let c = 0; c < M_COLS; c++) {
      if (isOnPlateau(r, c)) continue;
      if (!isAboveHorizon(r, c)) continue;
      const x = rng();
      if (x < 0.040) grid[r][c] = '.';
      else if (x < 0.055) grid[r][c] = '*';
    }
  }
  return grid.map((row) => row.join('')).join('\n');
})();

// === AURORA (animated, sky-only) ===
// Two-arm Archimedean spiral centred above the plateau (upper sky band),
// with a brightness wave that travels outward along the arms over the
// 60-frame cycle. Same algorithm as the intro aurora but masked so
// glyphs only land in sky cells (never on the plateau).
// Aurora spiral centred in the upper third of the sky band. With horizon
// now at ~row 16 there's enough room for the full intro-aurora geometry.
const AURORA_CENTER_ROW = 7;
const AURORA_CENTER_COL = Math.floor(M_COLS / 2);
const AURORA_Y_SCALE    = 0.5;
const AURORA_MAX_THETA  = 4.5 * Math.PI;
const AURORA_A          = 0.8;
const AURORA_B          = 0.95;
const AURORA_ARMS       = 2;

function auroraGlyph(intensity: number): string | null {
  if (intensity >= 0.70) return '*';
  if (intensity >= 0.50) return ':';
  if (intensity >= 0.30) return '\'';
  if (intensity >= 0.10) return '.';
  return null;
}

function makeAuroraFrame(t: number): string {
  const grid = blank(M_ROWS, M_COLS);
  const wavePhase = 2 * Math.PI * (t / AURORA_FRAMES_COUNT);
  const cells = new Map<string, number>();
  for (let arm = 0; arm < AURORA_ARMS; arm++) {
    const armPhase = (arm * 2 * Math.PI) / AURORA_ARMS;
    for (let theta = 0; theta <= AURORA_MAX_THETA; theta += 0.025) {
      const r = AURORA_A + AURORA_B * theta;
      const x = r * Math.cos(theta + armPhase);
      const y = r * Math.sin(theta + armPhase) * AURORA_Y_SCALE;
      const col = Math.round(AURORA_CENTER_COL + x);
      const row = Math.round(AURORA_CENTER_ROW + y);
      if (col < 0 || col >= M_COLS) continue;
      if (row < 0 || row >= M_ROWS) continue;
      if (isOnPlateau(row, col)) continue;
      if (!isAboveHorizon(row, col)) continue;
      const baseIntensity = 1 - 0.80 * (theta / AURORA_MAX_THETA);
      const wave = 0.5 + 0.5 * Math.sin(theta - wavePhase);
      const intensity = baseIntensity * (0.05 + 0.95 * wave);
      const key = `${row},${col}`;
      const prev = cells.get(key) ?? 0;
      if (intensity > prev) cells.set(key, intensity);
    }
  }
  for (const [key, intensity] of cells) {
    const g = auroraGlyph(intensity);
    if (!g) continue;
    const [r, c] = key.split(',').map(Number);
    grid[r][c] = g;
  }
  return grid.map((row) => row.join('')).join('\n');
}

export const AURORA_FRAMES: string[] = Array.from(
  { length: AURORA_FRAMES_COUNT },
  (_, t) => makeAuroraFrame(t)
);

// === DOOM-FIRE ALGORITHM ===
// Same heat-propagation algorithm as the intro hearth: seed bottom row with
// max heat, propagate upward with random column shift + cooling, then taper
// width so the flame narrows toward the tip and sways across the loop.

const HEAT_GLYPHS = " ..',**ooo@@";
const MAX_HEAT = HEAT_GLYPHS.length - 1;

function makeFireFrame(t: number, fireRows: number, fireCols: number, seedSalt: number): string[] {
  const rng = mulberry32(t * 17 + seedSalt);
  const seedHeat = MAX_HEAT;

  // Two extra seed rows beneath so the flame base never goes black.
  const heat: number[][] = Array.from(
    { length: fireRows + 2 },
    () => Array(fireCols).fill(0)
  );

  for (let row = fireRows; row < fireRows + 2; row++) {
    for (let c = 0; c < fireCols; c++) {
      heat[row][c] = Math.max(0, seedHeat - Math.floor(rng() * 2));
    }
  }

  for (let row = fireRows - 1; row >= 0; row--) {
    for (let c = 0; c < fireCols; c++) {
      const shift = Math.floor((rng() - 0.5) * 4);
      const srcCol = Math.max(0, Math.min(fireCols - 1, c + shift));
      const cool = Math.floor(rng() * 3);
      heat[row][c] = Math.max(0, heat[row + 1][srcCol] - cool);
    }
  }

  // Flame envelope: narrows toward the tip and sways across the loop.
  const cycle = (t * Math.PI * 2) / FRAMES;
  for (let row = 0; row < fireRows; row++) {
    const fromBottom = (fireRows - 1 - row) / Math.max(1, fireRows - 1);
    const halfWidth = (fireCols / 2) * Math.pow(1 - fromBottom, 0.6);
    const sway = Math.sin(cycle + fromBottom * 4.0) * (0.3 + fromBottom * 1.4);
    const center = fireCols / 2 + sway;
    const denom = Math.max(halfWidth, 0.5);
    for (let c = 0; c < fireCols; c++) {
      const d = Math.abs(c + 0.5 - center) / denom;
      const falloff = Math.max(0, 1 - d * d);
      heat[row][c] = Math.floor(heat[row][c] * falloff);
    }
  }

  return heat.slice(0, fireRows).map((row) =>
    row.map((h) => HEAT_GLYPHS[Math.min(h, MAX_HEAT)]).join('')
  );
}

function placeFireOnGrid(art: string[], row: number, col: number): string {
  const grid = blank(M_ROWS, M_COLS);
  placeBlock(grid, art, row, col);
  return grid.map((r) => r.join('')).join('\n');
}

// Animated frames — each frame is a full-canvas string with the fire art
// placed at the right offset, ready to drop into a single <pre> layer.

export const HEARTH_FIRE_FRAMES: string[] = Array.from({ length: FRAMES }, (_, t) => {
  const art = makeFireFrame(t, HEARTH_FIRE_ROWS, HEARTH_FIRE_COLS, 31);
  return placeFireOnGrid(art, HEARTH_FIRE_TOP, HEARTH_FIRE_LEFT);
});

export const CINDER_FIRE_FRAMES: string[] = Array.from({ length: FRAMES }, (_, t) => {
  const art = makeFireFrame(t, CINDER_FIRE_ROWS, CINDER_FIRE_COLS, 7);
  return placeFireOnGrid(art, CINDER_FIRE_TOP, CINDER_FIRE_LEFT);
});

// === WALKABILITY ===
// Walkable: plateau interior cells (anything inside the ellipse that
// isn't the cliff-edge ring or one of the interactable footprints).
// Sky (off-plateau) and cliff edges are non-walkable — apprentice
// would walk off the tableland.

function inBox(r: number, c: number, b: typeof HEARTH_BOX): boolean {
  return r >= b.rowMin && r <= b.rowMax && c >= b.colMin && c <= b.colMax;
}

export function isWalkable(row: number, col: number): boolean {
  if (row < 0 || row >= M_ROWS) return false;
  if (col < 0 || col >= M_COLS) return false;
  if (!isOnPlateau(row, col)) return false;
  if (isPlateauEdge(row, col)) return false;
  if (inBox(row, col, HEARTH_BOX)) return false;
  if (inBox(row, col, CINDER_BOX)) return false;
  return true;
}

// === INTERACTABLE DETECTION ===
export type InteractableId = 'hearth' | 'cinder';

export function interactableAt(row: number, col: number): InteractableId | null {
  if (inBox(row, col, HEARTH_BOX)) return 'hearth';
  if (inBox(row, col, CINDER_BOX)) return 'cinder';
  return null;
}

export function approachFor(id: InteractableId): { row: number; col: number } {
  return id === 'hearth' ? HEARTH_APPROACH : CINDER_APPROACH;
}
