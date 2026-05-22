// Top-down camp map — the Elder Fire sits on top of a tableland (chapada),
// an oval plateau in the middle of the canvas. Beyond the cliff edges is
// open sky, with the green spiral aurora swirling overhead and stars
// scattered through the rest of the sky. The Apprentice walks only on the
// plateau interior; the cliff edges are non-walkable (would fall off).
//
// Biome-aware build (DESIGN.md §5 / camp-reflects-stage):
// Static, biome-independent: plateau shape, walkability, hit-boxes,
// interactable positions, apprentice spawn, fire frames, aurora frames,
// dimensions, frame counts.
// Biome-varied: plateau-edge glyph (the cliff face), interior speckle (the
// ground texture), scree (the cliff-foot debris), star density (sky tone).
// All four shift with the current stage's biome — the camp travels with
// the tribe and changes with the latitude.

import { mulberry32 } from '../ascii/prng';
import { Rng, seedFrom } from '../../rng';
import type { SceneDims } from '../intro/scene-art';
import type { Biome } from '../../core/localmap';

export const MAP_DIMS: SceneDims = { cols: 60, rows: 54, rowPx: 14 };
export const FRAMES = 15;
export const AURORA_FRAMES_COUNT = 60;
const M_COLS = MAP_DIMS.cols;
const M_ROWS = MAP_DIMS.rows;

const PLATEAU_CENTER_ROW = 33;
const PLATEAU_CENTER_COL = Math.floor(M_COLS / 2);
const PLATEAU_SEMI_V     = 17;
const PLATEAU_SEMI_H     = 25;

function plateauRadiusFactor(angle: number): number {
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

const HEARTH_FIRE_ROWS = 8;
const HEARTH_FIRE_COLS = 13;
const HEARTH_FIRE_TOP  = 14;
const HEARTH_FIRE_LEFT = 24;
const HEARTH_PIT_ROW   = HEARTH_FIRE_TOP + HEARTH_FIRE_ROWS;

const HEARTH_PIT_ART = [
  ' .ooOoOoOoOo. ',
  '  `         `  '
];
const HEARTH_PIT_LEFT = HEARTH_FIRE_LEFT - 1;

const CINDER_FIRE_ROWS = 3;
const CINDER_FIRE_COLS = 5;
const CINDER_FIRE_TOP  = 34;
const CINDER_FIRE_LEFT = 28;
const CINDER_VESSEL_ROW = CINDER_FIRE_TOP + CINDER_FIRE_ROWS;

const CINDER_VESSEL_ART = [
  '[___]',
  ' \\_/ '
];
const CINDER_VESSEL_LEFT = CINDER_FIRE_LEFT;

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

export const APPRENTICE_SPAWN = {
  row: CINDER_APPROACH.row,
  col: CINDER_APPROACH.col - 3
};

interface BiomePalette {
  edge: string;
  interior: Array<[string, number]>;
  screeBand1: Array<[string, number]>;
  screeBand2: Array<[string, number]>;
  screeBandFar: Array<[string, number]>;
  starDensity: number;
}

const PALETTE: Record<Biome, BiomePalette> = {
  forest: {
    edge: '^',
    interior: [[',', 0.04], ["'", 0.03]],
    screeBand1: [[':', 0.45], ["'", 0.25], [',', 0.15]],
    screeBand2: [["'", 0.30], [',', 0.20], ['.', 0.10]],
    screeBandFar: [[',', 0.18], ['.', 0.12]],
    starDensity: 0.040,
  },
  coast: {
    edge: '~',
    interior: [["'", 0.05], ['~', 0.02], [',', 0.02]],
    screeBand1: [[':', 0.35], ["'", 0.25], ['~', 0.15]],
    screeBand2: [["'", 0.25], ['~', 0.15], [',', 0.10]],
    screeBandFar: [[',', 0.12], ['.', 0.10]],
    starDensity: 0.035,
  },
  ruins: {
    edge: '#',
    interior: [['.', 0.04], ["'", 0.03], ['%', 0.015]],
    screeBand1: [['%', 0.30], ['#', 0.20], [':', 0.20], [',', 0.10]],
    screeBand2: [['%', 0.15], [',', 0.20], ['.', 0.15]],
    screeBandFar: [[',', 0.15], ['.', 0.10]],
    starDensity: 0.040,
  },
  desert: {
    edge: '^',
    interior: [['.', 0.06], [':', 0.03]],
    screeBand1: [[',', 0.45], ['.', 0.30], [':', 0.10]],
    screeBand2: [[',', 0.30], ['.', 0.20]],
    screeBandFar: [['.', 0.20]],
    starDensity: 0.055,
  },
  mountain: {
    edge: '^',
    interior: [[',', 0.035], ["'", 0.025], ['^', 0.01]],
    screeBand1: [[':', 0.40], ['^', 0.20], [',', 0.20]],
    screeBand2: [["'", 0.25], [',', 0.20], ['.', 0.10]],
    screeBandFar: [[',', 0.20], ['.', 0.12]],
    starDensity: 0.050,
  },
  jungle: {
    edge: '*',
    interior: [['"', 0.08], ["'", 0.05], ['*', 0.02]],
    screeBand1: [[',', 0.35], ["'", 0.25], ['"', 0.15]],
    screeBand2: [[',', 0.25], ["'", 0.15], ['.', 0.10]],
    screeBandFar: [[',', 0.15], ['.', 0.10]],
    starDensity: 0.025,
  },
  isthmus: {
    edge: '~',
    interior: [["'", 0.04], ['~', 0.025]],
    screeBand1: [[':', 0.30], ["'", 0.20], ['~', 0.20]],
    screeBand2: [["'", 0.20], ['~', 0.15], [',', 0.10]],
    screeBandFar: [[',', 0.12], ['.', 0.10]],
    starDensity: 0.030,
  },
  alpine: {
    edge: '^',
    interior: [[',', 0.02], ["'", 0.015]],
    screeBand1: [[':', 0.50], [',', 0.30]],
    screeBand2: [[',', 0.25], ['.', 0.15]],
    screeBandFar: [['.', 0.18]],
    starDensity: 0.060,
  },
};

function pickWeighted(table: Array<[string, number]>, x: number): string {
  let acc = 0;
  for (const [glyph, w] of table) {
    acc += w;
    if (x < acc) return glyph;
  }
  return ' ';
}

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

function buildTerrain(palette: BiomePalette, seed: bigint, skipCells: Set<string>): string[] {
  const rng = new Rng(seed);
  const grid = blank(M_ROWS, M_COLS);

  for (let r = 0; r < M_ROWS; r++) {
    for (let c = 0; c < M_COLS; c++) {
      if (!isOnPlateau(r, c)) continue;
      // Path cells get skipped — cliff edge isn't painted where a road
      // will emerge, so the path layer reads as a genuine break in the
      // silhouette rather than a visual overlay.
      if (skipCells.has(`${r},${c}`)) continue;
      if (isPlateauEdge(r, c)) {
        grid[r][c] = palette.edge;
      } else {
        const g = pickWeighted(palette.interior, rng.nextFloat());
        if (g !== ' ') grid[r][c] = g;
      }
    }
  }

  placeBlock(grid, HEARTH_PIT_ART, HEARTH_PIT_ROW, HEARTH_PIT_LEFT);
  placeBlock(grid, CINDER_VESSEL_ART, CINDER_VESSEL_ROW, CINDER_VESSEL_LEFT);

  return grid.map((row) => row.join(''));
}

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

function buildScree(palette: BiomePalette, seed: bigint): string {
  const rng = new Rng(seed);
  const grid = blank(M_ROWS, M_COLS);
  const SCREE_REACH = 6;
  for (let r = 0; r < M_ROWS; r++) {
    for (let c = 0; c < M_COLS; c++) {
      if (isOnPlateau(r, c)) continue;
      if (isAboveHorizon(r, c)) continue;
      const d = distanceToPlateau(r, c, SCREE_REACH);
      if (d > SCREE_REACH) continue;
      const x = rng.nextFloat();
      const band = d === 1 ? palette.screeBand1
                : d === 2 ? palette.screeBand2
                : d <= 4  ? palette.screeBandFar
                : (x < 0.08 ? [[".", 1] as [string, number]] : []);
      const g = pickWeighted(band, x);
      if (g !== ' ') grid[r][c] = g;
    }
  }
  return grid.map((row) => row.join('')).join('\n');
}

function buildStars(palette: BiomePalette, seed: bigint): string {
  const rng = new Rng(seed);
  const grid = blank(M_ROWS, M_COLS);
  for (let r = 0; r < M_ROWS; r++) {
    for (let c = 0; c < M_COLS; c++) {
      if (isOnPlateau(r, c)) continue;
      if (!isAboveHorizon(r, c)) continue;
      const x = rng.nextFloat();
      if (x < palette.starDensity) grid[r][c] = '.';
      else if (x < palette.starDensity + 0.015) grid[r][c] = '*';
    }
  }
  return grid.map((row) => row.join('')).join('\n');
}

export interface CampArt {
  biome: Biome;
  terrain: string[];
  scree: string;
  stars: string;
}

export function buildCampArt(biome: Biome, skipCells: Set<string> = new Set()): CampArt {
  const palette = PALETTE[biome];
  const seed = seedFrom('camp-art:' + biome);
  return {
    biome,
    terrain: buildTerrain(palette, seed, skipCells),
    scree: buildScree(palette, seed ^ 1n),
    stars: buildStars(palette, seed ^ 2n),
  };
}

// Visual paths extending south from each gate (DESIGN.md §5 / camp-reflects-
// stage). The shape of the camp's southern side shifts with the number of
// reachable gates — 2 paths means 2 spokes, 4 means 4. Each path is biome-
// textured with its DESTINATION biome's palette, so the player sees hints of
// the terrain they're walking toward. The path starts at the southern
// plateau edge directly below the gate (not at the gate cell itself — the
// gate is a walkable interior cell, the path is the road leaving the plateau).
// Non-deterministic per build (operator dropped all 4 determinism axes).

export interface PathGate {
  biome: Biome;
  gateRow: number;
  gateCol: number;
}

const PATH_DEPTH = 8;        // how many rows south of the plateau edge
const PATH_HALF_WIDTH = 4;   // path is 2*halfwidth+1 = 9 cols wide
                             // (was 2/5 cols — cliff curve in adjacent cols
                             // still showed `^` glyphs around the path)

// Center-line glyph: a solid road. Strong enough to read as "the road" from
// any biome's shoulder texture. `:` reads as traveled ground / packed dirt.
const PATH_CENTER_GLYPH = ':';

export function buildPaths(gates: PathGate[]): string {
  const grid = blank(M_ROWS, M_COLS);
  if (gates.length === 0) return grid.map((row) => row.join('')).join('\n');

  const rng = new Rng(seedFrom(`paths:${Date.now()}:${Math.random()}`));

  for (const gate of gates) {
    const palette = PALETTE[gate.biome];
    // Find the southern edge of the plateau directly below this gate.
    // Start painting from EDGE_BREAK rows ABOVE the edge so the path cuts
    // through the cliff-edge ring — render order in CampScene puts paths
    // after terrain, so this overpaints the `^`/`~`/`#`/`*` cliff glyphs
    // creating a visible gap where the road emerges from the plateau.
    let edgeRow = gate.gateRow;
    while (edgeRow < M_ROWS && isOnPlateau(edgeRow, gate.gateCol)) {
      edgeRow++;
    }
    const EDGE_BREAK = 4; // how many rows of cliff edge to break through
                          // (was 2 — cliff curve in adjacent cols sits at
                          // varying rows; deeper break clears them all)
    for (let dr = -EDGE_BREAK; dr < PATH_DEPTH; dr++) {
      const r = edgeRow + dr;
      if (r < 0 || r >= M_ROWS) continue;
      for (let dc = -PATH_HALF_WIDTH; dc <= PATH_HALF_WIDTH; dc++) {
        const c = gate.gateCol + dc;
        if (c < 0 || c >= M_COLS) continue;
        if (dc === 0) {
          // Center column: solid road, always painted (including through
          // the cliff-edge band, breaking the silhouette where the road
          // emerges).
          grid[r][c] = PATH_CENTER_GLYPH;
        } else {
          // Shoulder columns: biome-textured speckle. ALWAYS paint — if the
          // weighted pick falls through to space, use the most-likely glyph
          // in the palette as a fallback. This prevents the underlying
          // cliff-edge `^/~/#/*` glyphs from leaking through where the path
          // breaks the silhouette.
          let g = pickWeighted(palette.screeBand1, rng.nextFloat());
          if (g === ' ') g = palette.screeBand1[0]?.[0] ?? ':';
          grid[r][c] = g;
        }
      }
    }
  }

  return grid.map((row) => row.join('')).join('\n');
}

// Compute the set of cells the path layer will paint, so buildTerrain knows
// to skip painting cliff edge there. Mirrors buildPaths's geometry exactly:
// from EDGE_BREAK rows above the plateau-south-edge down PATH_DEPTH rows,
// PATH_HALF_WIDTH columns either side of each gate column.
export function pathCells(gates: PathGate[]): Set<string> {
  const cells = new Set<string>();
  const EDGE_BREAK = 4;
  for (const gate of gates) {
    let edgeRow = gate.gateRow;
    while (edgeRow < M_ROWS && isOnPlateau(edgeRow, gate.gateCol)) {
      edgeRow++;
    }
    for (let dr = -EDGE_BREAK; dr < PATH_DEPTH; dr++) {
      const r = edgeRow + dr;
      if (r < 0 || r >= M_ROWS) continue;
      for (let dc = -PATH_HALF_WIDTH; dc <= PATH_HALF_WIDTH; dc++) {
        const c = gate.gateCol + dc;
        if (c < 0 || c >= M_COLS) continue;
        cells.add(`${r},${c}`);
      }
    }
  }
  return cells;
}

// The walkable cells along each path — center column only (not the
// shoulders). The apprentice walks down the road; the shoulders are
// scenery. Mirrors buildPaths's center-line geometry. Used by CampScene's
// tryMove to allow walking off the plateau down a road to a gate marker.
export function pathWalkCells(gates: PathGate[]): Set<string> {
  const cells = new Set<string>();
  const EDGE_BREAK = 4;
  for (const gate of gates) {
    let edgeRow = gate.gateRow;
    while (edgeRow < M_ROWS && isOnPlateau(edgeRow, gate.gateCol)) {
      edgeRow++;
    }
    for (let dr = -EDGE_BREAK; dr < PATH_DEPTH; dr++) {
      const r = edgeRow + dr;
      if (r < 0 || r >= M_ROWS) continue;
      const c = gate.gateCol;
      if (c < 0 || c >= M_COLS) continue;
      cells.add(`${r},${c}`);
    }
  }
  return cells;
}

// Gate marker positions — where the numbered digit appears AND where
// stepping onto the cell triggers onEnterLeg. Each gate's marker is the
// southernmost cell of its path center column, clamped to canvas bounds.
// Returns one entry per gate in the same order as input.
export interface GateMarker {
  row: number;
  col: number;
}
export function gateMarkerCells(gates: PathGate[]): GateMarker[] {
  const markers: GateMarker[] = [];
  for (const gate of gates) {
    let edgeRow = gate.gateRow;
    while (edgeRow < M_ROWS && isOnPlateau(edgeRow, gate.gateCol)) {
      edgeRow++;
    }
    const targetRow = Math.min(edgeRow + PATH_DEPTH - 1, M_ROWS - 1);
    markers.push({ row: targetRow, col: gate.gateCol });
  }
  return markers;
}

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

const HEAT_GLYPHS = " ..',**ooo@@";
const MAX_HEAT = HEAT_GLYPHS.length - 1;

function makeFireFrame(t: number, fireRows: number, fireCols: number, seedSalt: number): string[] {
  const rng = mulberry32(t * 17 + seedSalt);
  const seedHeat = MAX_HEAT;

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

export const HEARTH_FIRE_FRAMES: string[] = Array.from({ length: FRAMES }, (_, t) => {
  const art = makeFireFrame(t, HEARTH_FIRE_ROWS, HEARTH_FIRE_COLS, 31);
  return placeFireOnGrid(art, HEARTH_FIRE_TOP, HEARTH_FIRE_LEFT);
});

export const CINDER_FIRE_FRAMES: string[] = Array.from({ length: FRAMES }, (_, t) => {
  const art = makeFireFrame(t, CINDER_FIRE_ROWS, CINDER_FIRE_COLS, 7);
  return placeFireOnGrid(art, CINDER_FIRE_TOP, CINDER_FIRE_LEFT);
});

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

export type InteractableId = 'hearth' | 'cinder';

export function interactableAt(row: number, col: number): InteractableId | null {
  if (inBox(row, col, HEARTH_BOX)) return 'hearth';
  if (inBox(row, col, CINDER_BOX)) return 'cinder';
  return null;
}

export function approachFor(id: InteractableId): { row: number; col: number } {
  return id === 'hearth' ? HEARTH_APPROACH : CINDER_APPROACH;
}
