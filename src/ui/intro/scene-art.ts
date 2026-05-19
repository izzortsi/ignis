// Intro scene ASCII art.
//
// Present-day only. The world is what the apprentice has always known —
// every visible anomaly (the green spiral aurora overhead, yellowed trees,
// red dawn sun, the Hearth riding in its bronze cart) is just normal.
// Nothing about "before" is shown or explained.

import { mulberry32 } from '../ascii/prng';

// Each scene declares its own canvas dims (cols × rows × rowPx). The
// IntroScene reads them per phase to size the stage; mobile-first design
// means animated scenes are portrait, dense flashbacks are taller still.
export const FRAMES = 15;

export interface SceneDims {
  cols: number;
  rows: number;
  rowPx: number;
}

// Camp scene (dawn / kindle / named) — animated, layered, present-day.
// 72×58: tightened from the previous 64×80 so the canvas fills phone width
// while leaving enough room below for the skip hint + Begin button without
// vertical scroll on the smallest mainstream phones (iPhone SE 375×667).
// Vertical compression cuts pure-sky rows and trims smoke/ember rise.
export const CAMP_DIMS: SceneDims = { cols: 72, rows: 58, rowPx: 14 };

// Mirror leak (flashback 2) — dense static reproduction matching the Rio
// flashback's woodcut style.
export const MIRROR_DIMS: SceneDims = { cols: 113, rows: 110, rowPx: 14 };

// Rio Miyake (flashback 1) — dense density-mapped reproduction.
export const RIO_DIMS: SceneDims = { cols: 115, rows: 109, rowPx: 14 };

// Internal aliases so each section's loops stay readable. Mirror & Rio are
// static density-mapped arrays now — they don't need short aliases.
const C_COLS = CAMP_DIMS.cols;
const C_ROWS = CAMP_DIMS.rows;

// All camp art was originally laid out for a 50-col canvas. CAMP_OFFSET
// shifts every placement right so the original composition stays centered
// when CAMP_DIMS.cols is wider than 50.
const CAMP_OFFSET = Math.floor((C_COLS - 50) / 2);

function blank(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(' '));
}

function gridToArt(grid: string[][]): string[] {
  const cols = grid[0]?.length ?? 0;
  return grid.map((r) => {
    const s = r.join('');
    return s.length >= cols ? s.slice(0, cols) : s + ' '.repeat(cols - s.length);
  });
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

// ---------------------------------------------------------------------------
// SKY — stars (twinkling) and the green spiral aurora. Portrait camp.
// Sky region is rows 0..27; mountains begin at row 28.
// ---------------------------------------------------------------------------

// Aurora spiral — two-arm Archimedean spiral squished vertically (factor
// AURORA_Y_SCALE) to read as round despite the ~2:1 cell aspect ratio.
// Cells carry an intensity value 0..1 that maps to a sparse glyph ramp,
// so the core reads dense and outer arms feather out.
const AURORA_CENTER_ROW = 7;
const AURORA_CENTER_COL = Math.floor(C_COLS / 2);
const AURORA_Y_SCALE    = 0.5;
const AURORA_MAX_THETA  = 4.5 * Math.PI;
const AURORA_A          = 0.8;
const AURORA_B          = 0.95;
const AURORA_ARMS       = 2;
const AURORA_SKY_ROWS   = 16;

const AURORA_CELLS: Map<string, number> = (() => {
  const cells = new Map<string, number>();
  for (let arm = 0; arm < AURORA_ARMS; arm++) {
    const armPhase = (arm * 2 * Math.PI) / AURORA_ARMS;
    for (let theta = 0; theta <= AURORA_MAX_THETA; theta += 0.025) {
      const r = AURORA_A + AURORA_B * theta;
      const x = r * Math.cos(theta + armPhase);
      const y = r * Math.sin(theta + armPhase) * AURORA_Y_SCALE;
      const col = Math.round(AURORA_CENTER_COL + x);
      const row = Math.round(AURORA_CENTER_ROW + y);
      if (col < 0 || col >= C_COLS) continue;
      if (row < 0 || row >= AURORA_SKY_ROWS) continue;
      const intensity = 1 - 0.80 * (theta / AURORA_MAX_THETA);
      const key = `${row},${col}`;
      const prev = cells.get(key) ?? 0;
      if (intensity > prev) cells.set(key, intensity);
    }
  }
  return cells;
})();

// Cells dense enough that overlapping a star glyph would muddle the spiral.
const AURORA_CORE_CELLS: Set<string> = (() => {
  const set = new Set<string>();
  for (const [key, intensity] of AURORA_CELLS) {
    if (intensity >= 0.4) set.add(key);
  }
  return set;
})();

// Sparse density ramp: bright core, then faint outer wisps. Cells below
// the floor get no glyph at all, so the spiral feathers off cleanly.
function auroraGlyph(intensity: number): string | null {
  if (intensity >= 0.70) return '*';
  if (intensity >= 0.50) return ':';
  if (intensity >= 0.30) return '\'';
  if (intensity >= 0.10) return '.';
  return null;
}

// Stars scattered through the sky region. Each row gets ~5 stars across the
// full 72-col canvas width; stars overlapping the aurora's dense core are
// filtered out below so the spiral reads cleanly. Sky region is rows 0..15.
const STAR_POSITIONS_RAW: ReadonlyArray<readonly [number, number]> = [
  [0, 5],  [0, 22], [0, 38], [0, 55], [0, 67],
  [1, 14], [1, 31], [1, 45], [1, 60], [1, 70],
  [2, 9],  [2, 26], [2, 42], [2, 57], [2, 68],
  [3, 17], [3, 35], [3, 48], [3, 61], [3, 70],
  [4, 4],  [4, 22], [4, 39], [4, 54], [4, 65],
  [5, 12], [5, 30], [5, 46], [5, 59], [5, 69],
  [6, 7],  [6, 25], [6, 42], [6, 57], [6, 67],
  [7, 16], [7, 34], [7, 49], [7, 61], [7, 70],
  [8, 3],  [8, 20], [8, 38], [8, 53], [8, 64],
  [9, 11], [9, 29], [9, 46], [9, 58], [9, 68],
  [10, 6], [10, 24], [10, 40], [10, 55], [10, 65],
  [11, 14], [11, 32], [11, 48], [11, 60], [11, 70],
  [12, 8], [12, 27], [12, 43], [12, 56], [12, 66],
  [13, 18], [13, 36], [13, 52], [13, 64],
  [14, 4], [14, 22], [14, 41], [14, 57], [14, 68],
  [15, 12], [15, 30], [15, 46], [15, 60], [15, 70]
];

// Filter with a zero-cell buffer against the dense aurora core so stars
// don't pile glyphs on top of the brightest spiral cells. Faint outer
// tendrils mix harmlessly with stars.
function isOnAuroraCore(row: number, col: number): boolean {
  return AURORA_CORE_CELLS.has(`${row},${col}`);
}

const STAR_POSITIONS: ReadonlyArray<readonly [number, number]> =
  STAR_POSITIONS_RAW.filter(([r, c]) => !isOnAuroraCore(r, c));

export const STAR_FIELD: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  for (const [r, c] of STAR_POSITIONS) grid[r][c] = '.';
  return gridToArt(grid);
})();

// Per-star sine pulse: each star has its own phase offset so the sky
// shimmers in waves instead of all stars pulsing in unison. Two intensity
// tiers (medium + bright) give a sense of depth — many quiet stars
// breathing through their middle band, a few bright at any moment.
//
// All stars share the same TWINKLE_FRAMES cycle length so the pre-generated
// frame array loops seamlessly.

export const TWINKLE_FRAMES = 60;

function starSinePhase(r: number, c: number): number {
  return (r * 7.13 + c * 1.37) % (2 * Math.PI);
}

function starBrightness(idx: number, t: number): number {
  const [r, c] = STAR_POSITIONS[idx];
  const phase = starSinePhase(r, c);
  return (Math.sin((t / TWINKLE_FRAMES) * 2 * Math.PI + phase) + 1) / 2;
}

const STARS_BRIGHT_THRESHOLD = 0.82;
const STARS_MED_THRESHOLD    = 0.50;

export const STARS_MED_FRAMES: string[][] = Array.from({ length: TWINKLE_FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  for (let i = 0; i < STAR_POSITIONS.length; i++) {
    const b = starBrightness(i, t);
    if (b > STARS_MED_THRESHOLD && b <= STARS_BRIGHT_THRESHOLD) {
      const [r, c] = STAR_POSITIONS[i];
      grid[r][c] = '*';
    }
  }
  return gridToArt(grid);
});

export const STARS_BRIGHT_FRAMES: string[][] = Array.from({ length: TWINKLE_FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  for (let i = 0; i < STAR_POSITIONS.length; i++) {
    if (starBrightness(i, t) > STARS_BRIGHT_THRESHOLD) {
      const [r, c] = STAR_POSITIONS[i];
      grid[r][c] = '*';
    }
  }
  return gridToArt(grid);
});

// Aurora-spiral art — the green spiral that hangs in the upper sky. The
// protagonist's culture takes it for granted; the player infers what it
// actually is (residue of the Miyake-class CME shown in flashback 1).
//
// The arm geometry stays fixed; what flows is the brightness, a sine wave
// in `theta - wavePhase` that marches the bright glyphs outward along
// each arm. One full wave per AURORA_FRAMES, so the loop is seamless.
export const AURORA_FRAMES_COUNT = 60;

export const AURORA_FRAMES: string[][] = Array.from(
  { length: AURORA_FRAMES_COUNT },
  (_, t) => {
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
        if (col < 0 || col >= C_COLS) continue;
        if (row < 0 || row >= AURORA_SKY_ROWS) continue;
        const baseIntensity = 1 - 0.80 * (theta / AURORA_MAX_THETA);
        const wave = 0.5 + 0.5 * Math.sin(theta - wavePhase);
        const intensity = baseIntensity * (0.05 + 0.95 * wave);
        const key = `${row},${col}`;
        const prev = cells.get(key) ?? 0;
        if (intensity > prev) cells.set(key, intensity);
      }
    }
    const grid = blank(C_ROWS, C_COLS);
    for (const [key, intensity] of cells) {
      const g = auroraGlyph(intensity);
      if (g === null) continue;
      const [r, c] = key.split(',').map(Number);
      grid[r][c] = g;
    }
    return gridToArt(grid);
  }
);

// ---------------------------------------------------------------------------
// LAND — far mountains, near foothills (with yellowed-tree glyphs), ground.
// Tightened layout: horizon at row 16; foothills at rows 19-22; ground at
// the bottom two rows of the canvas.
// ---------------------------------------------------------------------------

// 72-col silhouettes: span the full camp canvas edge-to-edge so the land
// reaches as wide as the sky. Far range = 4 angular peaks (3-wide and
// 5-wide tops alternating); near range = a rolling 5-hill foothill
// silhouette with asterisk trees on top of each hill.
const MOUNTAINS_FAR_ART = [
  '       ___              _____              ___              _____       ',
  '   ___/   \\___        _/     \\___      ___/   \\___        _/     \\___   ',
  '__/           \\______/           \\____/           \\______/           \\__'
];

const MOUNTAINS_NEAR_ART = [
  '                                                                        ',
  '            *              *            *              *           *    ',
  '          ,_*_,          ,_*_,        ,_*_,          ,_*_,       ,_*_,  ',
  '/      __/     \\___    _/    \\__   _/     \\____   __/    \\___   _/     \\'
];

export const MOUNTAINS_FAR: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, MOUNTAINS_FAR_ART, 16, 0);
  return gridToArt(grid);
})();

export const MOUNTAINS_NEAR: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, MOUNTAINS_NEAR_ART, 19, 0);
  return gridToArt(grid);
})();

// Ground line + faint scatter at the very bottom of the canvas.
export const GROUND: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  grid[C_ROWS - 2] = '~'.repeat(C_COLS).split('');
  const r = mulberry32(29);
  for (let c = 0; c < C_COLS; c++) {
    if (r() < 0.15) grid[C_ROWS - 1][c] = '.';
    else if (r() < 0.25) grid[C_ROWS - 1][c] = ',';
  }
  return gridToArt(grid);
})();

// ---------------------------------------------------------------------------
// TRIBE — figures gathered around the Hearth for the initiation ritual.
//   * Tender:     hooded elder with a staff (4-col sprite, ceremonial)
//   * Apprentice: 3-row simpler young figure (still, holds vessel)
//   * Drummer:    one of the front-row dancers, has [O] hip drum
//   * Tribe:      4-row dancers with variable heads (___, .o., ~o~)
//   * Back row:   3-row smaller figures further back/up (depth)
// Each figure has 2 dance poses; the dance toggles every 2 ticks per
// figure with its own phase offset, so the tribe is never in lockstep.
// ---------------------------------------------------------------------------

interface FigureSprite {
  still:   string[];
  walkA?:  string[];   // optional — only walkers need walking poses
  walkB?:  string[];
  danceA:  string[];
  danceB:  string[];
}

interface FigurePosition {
  col:          number;
  row:          number;
  sprite:       FigureSprite;
  phaseOffset:  number;   // dance/walk phase, ticks
}

const FIGURE_ROW    = 45;       // front-row standing-figure top row
const BACK_ROW      = 42;       // back-row figure top row (3-row tall, smaller)
const APPR_ROW      = 46;       // apprentice top row (3-row, feet at row 48)

const TENDER_COL     = 5  + CAMP_OFFSET;  // canvas col 16
const APPRENTICE_COL = 41 + CAMP_OFFSET;  // canvas col 52

// Hooded elder with vertical staff on the right edge (4-col sprite).
const TENDER_SPRITE: FigureSprite = {
  still:  ['/^\\|', '(o)|',  '/|\\|', '/ \\|'],
  walkA:  ['/^\\|', '(o)|',  '/|\\|', '/ \\|'],   // legs spread (planted)
  walkB:  ['/^\\|', '(o)|',  '/|\\|', '| ||'],   // legs together (mid-step)
  danceA: ['/^\\|', '(o)|',  '\\|/|', '/ \\|'],
  danceB: ['/^\\|', '(o)|',  '-|-|',  '| ||']
};

// Younger figure: 3 rows, no head decoration, reaching-arm glyph (/|.)
// points to the Cinder vessel one row down. Apprentice never dances.
const APPRENTICE_SPRITE: FigureSprite = {
  still:  [',o,', '/|.', '/ \\'],
  walkA:  [',o,', '/|\\', '/ \\'],   // arms straight, legs spread (walking)
  walkB:  [',o,', '/|\\', '| |'],   // arms straight, legs together
  danceA: [',o,', '/|.', '/ \\'],
  danceB: [',o,', '/|.', '/ \\']
};

// Drummer: arms swap on dance (drumming motion); legs are replaced by the
// drum, so no leg swap.
const DRUMMER_SPRITE: FigureSprite = {
  still:  [',-.', '(o)', '/|\\', '[O]'],
  walkA:  [',-.', '(o)', '/|\\', '[O]'],
  walkB:  [',-.', '(o)', '/|\\', '[o]'],   // drum bobs slightly while walking
  danceA: [',-.', '(o)', '\\|/', '[O]'],
  danceB: [',-.', '(o)', '-|-',  '[O]']
};

// Generic 4-row tribe figure with a custom head — body/arms/legs identical
// across the tribe, only the head varies for visual diversity.
function tribeSprite(head: string): FigureSprite {
  return {
    still:  [head, '(o)', '/|\\', '/ \\'],
    walkA:  [head, '(o)', '/|\\', '/ \\'],
    walkB:  [head, '(o)', '/|\\', '| |'],
    danceA: [head, '(o)', '\\|/', '/ \\'],
    danceB: [head, '(o)', '-|-',  '| |']
  };
}

const TRIBE_HEAD_FLAT  = tribeSprite('___');
const TRIBE_HEAD_TUFT  = tribeSprite('.o.');
const TRIBE_HEAD_WAVE  = tribeSprite('~o~');

// Back-row 3-row sprites: smaller (no full body), suggest distance.
function backRowSprite(head: string): FigureSprite {
  return {
    still:  [head, '/|\\', '/ \\'],
    danceA: [head, '\\|/', '/ \\'],
    danceB: [head, '-|-',  '| |']
  };
}

const BACK_HEAD_PEAK = backRowSprite('/^\\');
const BACK_HEAD_DOT  = backRowSprite(',o,');
const BACK_HEAD_FACE = backRowSprite('(o)');
const BACK_HEAD_TUFT = backRowSprite('.o.');

// Standalone exports for layers rendered separately.
export const TENDER: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, TENDER_SPRITE.still, FIGURE_ROW, TENDER_COL);
  return gridToArt(grid);
})();

export const APPRENTICE: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, APPRENTICE_SPRITE.still, APPR_ROW, APPRENTICE_COL);
  return gridToArt(grid);
})();

// === Bed scene (wake_dream phase) ==========================================
// Apprentice in bed, just woken from a dream. Inside a hut: peaked roof,
// vertical wall outlines, bed in the centre with the Apprentice sitting
// up. Dim atmosphere — no aurora/stars rendered in this phase.

const HUT_FRAME_ART = [
  '              .              ',     // a single distant star through the smoke hole
  '             /.\\             ',
  '            /   \\            ',
  '           /     \\           ',
  '          /       \\          ',
  '         /         \\         ',
  '        /           \\        ',
  '       /             \\       ',
  '      /               \\      ',
  '     /                 \\     ',
  '    /                   \\    ',
  '   /                     \\   ',
  '  /                       \\  ',
  ' /                         \\ ',
  '/___________________________\\'
];

const APPR_IN_BED_ART = [
  '   ,o,    ',     // head, awake
  '  /===\\   ',     // blanket draped over body
  ' /=====\\  ',     // wider blanket
  '[_______]'      // bed frame
];

const HUT_FRAME_ROW   = 18;                                    // peak high in canvas
const HUT_FRAME_COL   = Math.floor((C_COLS - HUT_FRAME_ART[0].length) / 2);
const APPR_BED_ROW    = HUT_FRAME_ROW + HUT_FRAME_ART.length - APPR_IN_BED_ART.length - 1;
const APPR_BED_COL    = Math.floor((C_COLS - APPR_IN_BED_ART[0].length) / 2);

export const HUT_FRAME: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, HUT_FRAME_ART, HUT_FRAME_ROW, HUT_FRAME_COL);
  return gridToArt(grid);
})();

export const APPRENTICE_IN_BED: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, APPR_IN_BED_ART, APPR_BED_ROW, APPR_BED_COL);
  return gridToArt(grid);
})();

// === Sun (test_morning sandbox phase) ======================================
// Simple sun sprite for the daylight test scene — single big glyph with
// rays. Placed in the upper-right sky region, well clear of the mountains
// and the camp composition below.

const SUN_ART = [
  '\\ | /',
  '- O -',
  '/ | \\'
];
const SUN_ROW = 4;
const SUN_COL = 56;

export const SUN: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, SUN_ART, SUN_ROW, SUN_COL);
  return gridToArt(grid);
})();

// === Tribe layout ==========================================================
// Two depth tiers around the Hearth (the third / far-distant tier was
// removed — it cluttered the composition without adding much):
//   * Tier 1 (FRONT_TRIBE)   — rows 45-48, 4-row sprites, 4 dancers + Drummer
//   * Tier 2 (BACK_TRIBE)    — rows 42-44, 3-row sprites, 6 figures
//
// PhaseOffsets for animated figures are unique values spread across
// [0, 14], so each transitions at a different tick within the 15-frame
// dance cycle.

const FRONT_TRIBE: FigurePosition[] = [
  { col:  4, row: FIGURE_ROW, sprite: TRIBE_HEAD_FLAT, phaseOffset:  0 },
  { col: 11, row: FIGURE_ROW, sprite: DRUMMER_SPRITE,  phaseOffset:  8 },
  { col: 60, row: FIGURE_ROW, sprite: TRIBE_HEAD_TUFT, phaseOffset:  4 },
  { col: 66, row: FIGURE_ROW, sprite: TRIBE_HEAD_WAVE, phaseOffset: 12 }
];

const BACK_TRIBE: FigurePosition[] = [
  { col:  1, row: BACK_ROW, sprite: BACK_HEAD_FACE, phaseOffset:  3 },
  { col:  8, row: BACK_ROW, sprite: BACK_HEAD_DOT,  phaseOffset:  2 },
  { col: 19, row: BACK_ROW, sprite: BACK_HEAD_TUFT, phaseOffset:  9 },
  { col: 56, row: BACK_ROW, sprite: BACK_HEAD_DOT,  phaseOffset:  5 },
  { col: 63, row: BACK_ROW, sprite: BACK_HEAD_PEAK, phaseOffset:  6 },
  { col: 69, row: BACK_ROW, sprite: BACK_HEAD_FACE, phaseOffset: 13 }
];

// Tender as a dancing figure (used in named only; in earlier phases the
// standalone TENDER layer is rendered instead).
const TENDER_DANCING: FigurePosition = {
  col: TENDER_COL, row: FIGURE_ROW, sprite: TENDER_SPRITE, phaseOffset: 10
};

// === Arriving (still composition for kindle) ===============================
// Front + back tiers in their resting `still` pose. Tender is its own
// layer; Apprentice + vessel join in the kindle phase.
export const ARRIVING_TRIBE: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  for (const fp of [...FRONT_TRIBE, ...BACK_TRIBE]) {
    placeBlock(grid, fp.sprite.still, fp.row, fp.col);
  }
  return gridToArt(grid);
})();

// === Walk-in animation =====================================================
// Only the four front-row dancers walk in (Drummer at col 11 is one of
// them). Tender + back-row + far-row figures appear instantly at the start
// of the arriving phase (Tender is the keeper of the fire; mid- and far-
// back tiers are observing from a distance, already gathered). Walkers
// slide at 1 col/tick from off-canvas, alternate walkA/walkB every 2 ticks,
// then snap to `still` once arrived.

interface Walker {
  startCol:    number;
  position:    FigurePosition;
  delay:       number;
}

const ARRIVING_WALKERS: Walker[] = [
  { startCol: -5,  position: FRONT_TRIBE[0], delay: 12 },  // far-left
  { startCol: -10, position: FRONT_TRIBE[1], delay:  0 },  // mid-left (drummer)
  { startCol: 75,  position: FRONT_TRIBE[2], delay:  0 },  // mid-right
  { startCol: 80,  position: FRONT_TRIBE[3], delay:  6 }   // far-right
];

export const WALKING_FRAMES_COUNT = 30;

// Back-row pop schedule: figures appear one at a time (in declared order)
// as the front row walks in, so the crowd fills out gradually rather than
// snapping in.
const BACK_POP_INTERVAL = 4;
const BACK_POP_TICKS: number[] = BACK_TRIBE.map((_, i) => i * BACK_POP_INTERVAL);

export const WALKING_FRAMES: string[][] = Array.from({ length: WALKING_FRAMES_COUNT }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);

  // Back-row figures pop in over time.
  for (let i = 0; i < BACK_TRIBE.length; i++) {
    if (t >= BACK_POP_TICKS[i]) {
      placeBlock(grid, BACK_TRIBE[i].sprite.still, BACK_TRIBE[i].row, BACK_TRIBE[i].col);
    }
  }

  for (const w of ARRIVING_WALKERS) {
    const adjT = Math.max(0, t - w.delay);
    const targetCol = w.position.col;
    const direction = targetCol > w.startCol ? 1 : -1;
    const distance = Math.abs(targetCol - w.startCol);
    const traveled = Math.min(distance, adjT);
    const col = w.startCol + direction * traveled;
    const stillWalking = adjT > 0 && traveled < distance;
    const sprite = w.position.sprite;
    const pose = stillWalking
      ? (((adjT >> 1) % 2 === 0 ? sprite.walkA : sprite.walkB) ?? sprite.still)
      : sprite.still;
    placeBlock(grid, pose, w.position.row, col);
  }
  return gridToArt(grid);
});

// === Walking to the fire (Tender + Apprentice approach) ====================
// Phase 2 of the intro: the Tender leads the Apprentice in from off-canvas
// left to their final ritual positions. Tender stops first at col 16 (left
// of the fire); Apprentice continues past the fire to col 52 (right of
// it). Apprentice's layer should render BEFORE the fire layer in JSX so
// the fire eclipses the Apprentice while she walks past — narratively the
// Apprentice walks behind the fire from camera POV.

const WALK_PAIR_TENDER_START = -5;     // off-canvas left
const WALK_PAIR_APPR_START   = -10;
const WALK_PAIR_TENDER_TARGET = TENDER_COL;       // 16
const WALK_PAIR_APPR_TARGET   = APPRENTICE_COL;   // 52
const WALK_PAIR_SPEED         = 2;     // cols per tick (faster than arriving)
const WALK_PAIR_APPR_DELAY    = 0;     // both start at the same tick

const _walkPairTenderTicks = Math.ceil(
  Math.abs(WALK_PAIR_TENDER_TARGET - WALK_PAIR_TENDER_START) / WALK_PAIR_SPEED
);
const _walkPairApprTicks = Math.ceil(
  Math.abs(WALK_PAIR_APPR_TARGET - WALK_PAIR_APPR_START) / WALK_PAIR_SPEED
);
export const WALK_PAIR_FRAMES_COUNT = Math.max(_walkPairTenderTicks, _walkPairApprTicks) + 4;

function makeWalkPairFrame(t: number, who: 'tender' | 'appr'): { col: number; pose: string[] } {
  const startCol  = who === 'tender' ? WALK_PAIR_TENDER_START  : WALK_PAIR_APPR_START;
  const targetCol = who === 'tender' ? WALK_PAIR_TENDER_TARGET : WALK_PAIR_APPR_TARGET;
  const sprite    = who === 'tender' ? TENDER_SPRITE           : APPRENTICE_SPRITE;
  const delay     = who === 'tender' ? 0                       : WALK_PAIR_APPR_DELAY;
  const adjT      = Math.max(0, t - delay);
  const direction = targetCol > startCol ? 1 : -1;
  const distance  = Math.abs(targetCol - startCol);
  const traveled  = Math.min(distance, adjT * WALK_PAIR_SPEED);
  const col       = startCol + direction * traveled;
  const stillWalking = adjT > 0 && traveled < distance;
  const pose = stillWalking
    ? (((adjT >> 1) % 2 === 0 ? sprite.walkA : sprite.walkB) ?? sprite.still)
    : sprite.still;
  return { col, pose };
}

// Apprentice is fully hidden ("behind the bonfire") whenever her sprite
// would overlap any column the fire occupies. The fire only fills rows
// 24-46, so without this masking the lower body would poke out below
// the flames at the apprentice's standing rows (46-48). Hiding cleanly
// reads as "she walks past the fire, momentarily out of sight".
//
// Hardcoded canvas range — HEARTH_FIRE_COL/HEARTH_FIRE_COLS are declared
// later in this file (initialization order) so we can't reference them
// here. They evaluate to: HEARTH_PIT_COL + 1 = 22, and 29 cols wide.
const FIRE_LEFT_CANVAS  = 22;
const FIRE_RIGHT_CANVAS = 22 + 29 - 1;   // 50
const APPR_WIDTH        = APPRENTICE_SPRITE.still[0].length;

function isApprBehindFire(col: number): boolean {
  const left = col;
  const right = col + APPR_WIDTH - 1;
  return right >= FIRE_LEFT_CANVAS && left <= FIRE_RIGHT_CANVAS;
}

// Two layers: WALK_PAIR_BEHIND (Apprentice — masked while behind the
// flames) and WALK_PAIR_FRONT (Tender — never enters the fire region).
export const WALK_PAIR_BEHIND_FRAMES: string[][] = Array.from({ length: WALK_PAIR_FRAMES_COUNT }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  const a = makeWalkPairFrame(t, 'appr');
  if (!isApprBehindFire(a.col)) {
    placeBlock(grid, a.pose, APPR_ROW, a.col);
  }
  return gridToArt(grid);
});

export const WALK_PAIR_FRONT_FRAMES: string[][] = Array.from({ length: WALK_PAIR_FRAMES_COUNT }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  const tn = makeWalkPairFrame(t, 'tender');
  placeBlock(grid, tn.pose, FIGURE_ROW, tn.col);
  return gridToArt(grid);
});

// === Dance frames ==========================================================
// In `named`, the front row + back row + Tender all cycle dance poses,
// each with a distinct phaseOffset so the tribe never moves in lockstep.
// The Apprentice (own layer) stays still through the whole dance.
const DANCING_FIGURES: FigurePosition[] = [
  ...FRONT_TRIBE,
  ...BACK_TRIBE,
  TENDER_DANCING
];

// Half-period swap: each figure spends ~7 ticks in danceA, ~8 in danceB
// across the 15-frame cycle. With unique phaseOffsets in [0, 14), every
// figure transitions at a different tick — the dance never marches in
// lockstep.
const DANCE_HALF = Math.floor(FRAMES / 2);

export const DANCING_TRIBE_FRAMES: string[][] = Array.from({ length: FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  for (const fp of DANCING_FIGURES) {
    const phase = (t + fp.phaseOffset) % FRAMES;
    const pose = phase < DANCE_HALF ? fp.sprite.danceA : fp.sprite.danceB;
    placeBlock(grid, pose, fp.row, fp.col);
  }
  return gridToArt(grid);
});

// ---------------------------------------------------------------------------
// HEARTH — the tribe's central never-extinguished fire, sitting in a stone
// pit at camp (mirrors the camp-map scene). 23 rows tall × 29 cols wide;
// the pit ring frames the fire base with one stone-col of border on each
// side. The Tender, Apprentice, and arriving/dancing tribe all stand on
// the same row level as the pit's base.
// ---------------------------------------------------------------------------

const HEARTH_PIT_ART = [
  ' .oOoOoOoOoOoOoOoOoOoOoOoOoOo. ',
  '  `                         `  '
];

const HEARTH_PIT_COL = 10 + CAMP_OFFSET; // pit left edge → 31 cols, centered
const HEARTH_PIT_ROW = 47;                // pit at rows 47-48 (above ground)

export const HEARTH_PIT: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, HEARTH_PIT_ART, HEARTH_PIT_ROW, HEARTH_PIT_COL);
  return gridToArt(grid);
})();

// Hearth fire — the Elder Fire is supposed to dominate the camp scene the
// way it dominates the top-view map. 23 rows tall × 29 cols wide; sits one
// row above the stone pit, with one stone-col of pit border on each side.
const HEARTH_FIRE_ROWS = 23;
const HEARTH_FIRE_COLS = 29;
const HEARTH_FIRE_BOTTOM = HEARTH_PIT_ROW - 1;
const HEARTH_FIRE_TOP    = HEARTH_FIRE_BOTTOM - HEARTH_FIRE_ROWS + 1;
const HEARTH_FIRE_COL    = HEARTH_PIT_COL + 1;           // 1-col pit border each side

const HEAT_GLYPHS = " ..',**ooo@@";
const MAX_HEAT = HEAT_GLYPHS.length - 1;

function makeHearthFireArt(t: number): string[] {
  const r = mulberry32(t * 17 + 31);
  const seedHeat = MAX_HEAT;

  const heat: number[][] = Array.from(
    { length: HEARTH_FIRE_ROWS + 2 },
    () => Array(HEARTH_FIRE_COLS).fill(0)
  );

  for (let row = HEARTH_FIRE_ROWS; row < HEARTH_FIRE_ROWS + 2; row++) {
    for (let c = 0; c < HEARTH_FIRE_COLS; c++) {
      heat[row][c] = Math.max(0, seedHeat - Math.floor(r() * 2));
    }
  }

  for (let row = HEARTH_FIRE_ROWS - 1; row >= 0; row--) {
    for (let c = 0; c < HEARTH_FIRE_COLS; c++) {
      const shift = Math.floor((r() - 0.5) * 4);
      const srcCol = Math.max(0, Math.min(HEARTH_FIRE_COLS - 1, c + shift));
      const cool = Math.floor(r() * 3);
      heat[row][c] = Math.max(0, heat[row + 1][srcCol] - cool);
    }
  }

  const cycle = (t * Math.PI * 2) / FRAMES;
  for (let row = 0; row < HEARTH_FIRE_ROWS; row++) {
    const fromBottom = (HEARTH_FIRE_ROWS - 1 - row) / (HEARTH_FIRE_ROWS - 1);
    const halfWidth = (HEARTH_FIRE_COLS / 2) * Math.pow(1 - fromBottom, 0.6);
    const sway = Math.sin(cycle + fromBottom * 4.0) * (0.3 + fromBottom * 1.4);
    const center = HEARTH_FIRE_COLS / 2 + sway;
    const denom = Math.max(halfWidth, 0.5);
    for (let c = 0; c < HEARTH_FIRE_COLS; c++) {
      const d = Math.abs(c + 0.5 - center) / denom;
      const falloff = Math.max(0, 1 - d * d);
      heat[row][c] = Math.floor(heat[row][c] * falloff);
    }
  }

  return heat.slice(0, HEARTH_FIRE_ROWS).map((row) =>
    row.map((h) => HEAT_GLYPHS[Math.min(h, MAX_HEAT)]).join('')
  );
}

export const HEARTH_FIRE_FRAMES: string[][] = Array.from({ length: FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, makeHearthFireArt(t), HEARTH_FIRE_TOP, HEARTH_FIRE_COL);
  return gridToArt(grid);
});

// ---------------------------------------------------------------------------
// CINDER — the apprentice's small personal vessel + its kindling fire.
// Portrait: vessel right of the apprentice (cols 38-42), fire grows above.
// ---------------------------------------------------------------------------

const CINDER_VESSEL_ART = [
  '[___]',
  ' \\_/ '
];

const CINDER_VESSEL_ROW = 49;
// The apprentice hieroglyph at col 56 renders at 5em font-size, which spans
// roughly cols 52-60 visually (square hieroglyph em-box, ~8 ch wide). Place
// the vessel at col 62 so its 5-col footprint (62-66) clears the glyph's
// right edge with a 1-col padding. This also clears the Cinder fire (which
// sits in the vessel's columns) out of the apprentice's body.
const CINDER_VESSEL_COL = 51 + CAMP_OFFSET;  // canvas col 62, right of apprentice glyph

export const CINDER_VESSEL: string[] = (() => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, CINDER_VESSEL_ART, CINDER_VESSEL_ROW, CINDER_VESSEL_COL);
  return gridToArt(grid);
})();

const CINDER_FIRE_ROWS = 3;
const CINDER_FIRE_COLS = 5;
const CINDER_FIRE_BOTTOM = CINDER_VESSEL_ROW - 1; // row 69
const CINDER_FIRE_TOP    = CINDER_FIRE_BOTTOM - CINDER_FIRE_ROWS + 1; // row 67

function makeCinderFireArt(t: number, intensity: number): string[] {
  // intensity 0..1 controls flame size during kindling
  const r = mulberry32(t * 23 + 7);
  const seedHeat = Math.max(0, Math.round(MAX_HEAT * intensity));
  if (seedHeat === 0) return Array(CINDER_FIRE_ROWS).fill(' '.repeat(CINDER_FIRE_COLS));

  const heat: number[][] = Array.from(
    { length: CINDER_FIRE_ROWS + 1 },
    () => Array(CINDER_FIRE_COLS).fill(0)
  );

  for (let c = 0; c < CINDER_FIRE_COLS; c++) {
    heat[CINDER_FIRE_ROWS][c] = Math.max(0, seedHeat - Math.floor(r() * 2));
  }
  for (let row = CINDER_FIRE_ROWS - 1; row >= 0; row--) {
    for (let c = 0; c < CINDER_FIRE_COLS; c++) {
      const shift = Math.floor((r() - 0.5) * 3);
      const srcCol = Math.max(0, Math.min(CINDER_FIRE_COLS - 1, c + shift));
      const cool = Math.floor(r() * 3);
      heat[row][c] = Math.max(0, heat[row + 1][srcCol] - cool);
    }
  }

  return heat.slice(0, CINDER_FIRE_ROWS).map((row) =>
    row.map((h) => HEAT_GLYPHS[Math.min(h, MAX_HEAT)]).join('')
  );
}

export const CINDER_FIRE_FRAMES: string[][] = Array.from({ length: FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  placeBlock(grid, makeCinderFireArt(t, 0.6), CINDER_FIRE_TOP, CINDER_VESSEL_COL);
  return gridToArt(grid);
});

export const CINDER_KINDLE_FRAMES: string[][] = Array.from({ length: FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  const intensity = Math.min(0.6, (t / (FRAMES - 1)) * 0.6);
  placeBlock(grid, makeCinderFireArt(t, intensity), CINDER_FIRE_TOP, CINDER_VESSEL_COL);
  return gridToArt(grid);
});

// ---------------------------------------------------------------------------
// HEARTH SMOKE — drifting particles above the Hearth fire. Tightened layout
// rises 10 rows from above the fire up to just above the foothills.
// ---------------------------------------------------------------------------

const HEARTH_SMOKE_STREAMS = [
  { col: 11 + CAMP_OFFSET, drift: -0.40, period: 24, chars: "'~ " },
  { col: 14 + CAMP_OFFSET, drift: -0.30, period: 22, chars: "~. " },
  { col: 17 + CAMP_OFFSET, drift: -0.15, period: 18, chars: "'~." },
  { col: 19 + CAMP_OFFSET, drift:  0.10, period: 20, chars: "'." },
  { col: 21 + CAMP_OFFSET, drift:  0.05, period: 17, chars: "~. " },
  { col: 23 + CAMP_OFFSET, drift: -0.10, period: 19, chars: "'~." },
  { col: 25 + CAMP_OFFSET, drift:  0.30, period: 23, chars: "~'.~" },
  { col: 27 + CAMP_OFFSET, drift:  0.10, period: 17, chars: "'." },
  { col: 29 + CAMP_OFFSET, drift:  0.00, period: 16, chars: "'~" },
  { col: 31 + CAMP_OFFSET, drift:  0.40, period: 19, chars: "'~." },
  { col: 33 + CAMP_OFFSET, drift: -0.10, period: 21, chars: "'~. " },
  { col: 36 + CAMP_OFFSET, drift: -0.25, period: 22, chars: "~." },
  { col: 39 + CAMP_OFFSET, drift:  0.30, period: 24, chars: "'~ " }
];

const HEARTH_SMOKE_BASE_ROW = HEARTH_FIRE_TOP - 1; // just above fire
const HEARTH_SMOKE_HEIGHT = 10;

export const HEARTH_SMOKE_FRAMES: string[][] = Array.from({ length: FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  for (let i = 0; i < HEARTH_SMOKE_STREAMS.length; i++) {
    const s = HEARTH_SMOKE_STREAMS[i];
    const phase = (t + i * 3) % s.period;
    if (phase >= HEARTH_SMOKE_HEIGHT) continue;
    const row = HEARTH_SMOKE_BASE_ROW - phase;
    const col = Math.floor(s.col + phase * s.drift);
    if (col < 0 || col >= C_COLS || row < 0) continue;
    const ch = s.chars[phase % s.chars.length];
    if (ch !== ' ') grid[row][col] = ch;
  }
  return gridToArt(grid);
});

// ---------------------------------------------------------------------------
// HEARTH EMBERS — bright sparks rising above the fire. Brighter, rise less
// than smoke. Origins clustered around the fire's apex.
// ---------------------------------------------------------------------------

const HEARTH_EMBER_SPARKS = [
  { col: 14 + CAMP_OFFSET, drift: -0.30, period: 13, chars: "*'." },
  { col: 16 + CAMP_OFFSET, drift:  0.30, period: 13, chars: "*'." },
  { col: 18 + CAMP_OFFSET, drift:  0.25, period: 13, chars: "*'." },
  { col: 20 + CAMP_OFFSET, drift: -0.15, period: 15, chars: "*'." },
  { col: 22 + CAMP_OFFSET, drift: -0.05, period: 16, chars: "*'." },
  { col: 24 + CAMP_OFFSET, drift:  0.30, period: 12, chars: "*'." },
  { col: 25 + CAMP_OFFSET, drift:  0.15, period: 14, chars: "*'." },
  { col: 26 + CAMP_OFFSET, drift: -0.20, period: 17, chars: "*'." },
  { col: 28 + CAMP_OFFSET, drift: -0.05, period: 11, chars: "*'." },
  { col: 30 + CAMP_OFFSET, drift:  0.35, period: 18, chars: "*'." },
  { col: 32 + CAMP_OFFSET, drift: -0.10, period: 14, chars: "*'." },
  { col: 34 + CAMP_OFFSET, drift: -0.30, period: 13, chars: "*'." },
  { col: 36 + CAMP_OFFSET, drift:  0.20, period: 12, chars: "*'." }
];

const HEARTH_EMBER_BASE_ROW = HEARTH_FIRE_TOP;
const HEARTH_EMBER_HEIGHT = 7;

export const HEARTH_EMBER_FRAMES: string[][] = Array.from({ length: FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  for (let i = 0; i < HEARTH_EMBER_SPARKS.length; i++) {
    const s = HEARTH_EMBER_SPARKS[i];
    const phase = (t + i * 4) % s.period;
    if (phase >= HEARTH_EMBER_HEIGHT) continue;
    const row = HEARTH_EMBER_BASE_ROW - phase;
    const col = Math.floor(s.col + phase * s.drift);
    if (col < 0 || col >= C_COLS || row < 0) continue;
    const ch = s.chars[Math.min(phase, s.chars.length - 1)];
    if (ch !== ' ') grid[row][col] = ch;
  }
  return gridToArt(grid);
});

// ---------------------------------------------------------------------------
// CINDER SMOKE — small smoke trail above the apprentice's vessel
// ---------------------------------------------------------------------------

const CINDER_SMOKE_STREAMS = [
  { col: 40 + CAMP_OFFSET, drift: 0.20, period: 8,  chars: "'." },
  { col: 39 + CAMP_OFFSET, drift: 0.35, period: 10, chars: "'.~" }
];

const CINDER_SMOKE_BASE_ROW = CINDER_FIRE_TOP - 1; // row 66
const CINDER_SMOKE_HEIGHT = 5;

export const CINDER_SMOKE_FRAMES: string[][] = Array.from({ length: FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  for (let i = 0; i < CINDER_SMOKE_STREAMS.length; i++) {
    const s = CINDER_SMOKE_STREAMS[i];
    const phase = (t + i * 3) % s.period;
    if (phase >= CINDER_SMOKE_HEIGHT) continue;
    const row = CINDER_SMOKE_BASE_ROW - phase;
    const col = Math.floor(s.col + phase * s.drift);
    if (col < 0 || col >= C_COLS || row < 0) continue;
    const ch = s.chars[phase % s.chars.length];
    if (ch !== ' ') grid[row][col] = ch;
  }
  return gridToArt(grid);
});

// ---------------------------------------------------------------------------
// GROUND BREEZE — sparse `~` glyphs drifting horizontally along the ground,
// suggesting wind moving through the camp. Subtle but visible.
// ---------------------------------------------------------------------------

const BREEZE_PARTICLES = [
  { row: C_ROWS - 1, period: 14, drift: 1, startCol: 0  },
  { row: C_ROWS - 1, period: 11, drift: 1, startCol: 22 },
  { row: C_ROWS - 2, period: 16, drift: 1, startCol: 44 }
];

export const BREEZE_FRAMES: string[][] = Array.from({ length: FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  for (const p of BREEZE_PARTICLES) {
    const phase = (t + p.startCol) % p.period;
    const col = (p.startCol + phase * p.drift) % C_COLS;
    if (col >= 0 && col < C_COLS) grid[p.row][col] = '~';
  }
  return gridToArt(grid);
});

// ---------------------------------------------------------------------------
// FLASHBACK 1 — Miyake-class CME spiral over Rio. Density-mapped ASCII
// reproduction of rj_miyake3.png at portrait 115×109. Single-layer static
// art (no parametric generation): the glyph ramp `@`/`%`/`#`/`+`/`=`/`*`/
// `:`/`.`/`-`/space encodes pixel intensity directly. Short rows are padded
// at module load so every line is exactly RIO_DIMS.cols wide.
// ---------------------------------------------------------------------------

export const RIO_MIYAKE: string[] = [
  '@@@@@@@@@...........@@@@@@@@@@@@@@@@@@@@@@@@.............@@@.....@@@@@@@@@@@@@@@@@@@@@@..... ..........*@@@@@@@@@@@',
  '@@@@@@@@@@...........@@@@@@@@@@@@@@@@@@@@@@@@............@@:....@@@@@@@@@@@@@@@@@@@@@................@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@..........@@@@@@@@@@@@@@@@@@@@@@@............@@....@@@@@@@@@@@@@@@@@@@.@..............@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@..........@@@@@@@@@@@@@@@@@@@@@@@...........*-. ..@@@@@@@@@@@@@@@@@@.*........... .@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@.........@@.@@@@@@@@@@@@@@@@@@@...........:....@@@@@@@@@@@@@@@@@..............+@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@%@@.... ... @:.@@@@@@@@@@@@@@@@@@:..............@@@@@@@@@@@@@@@@@.............%@@@@@@@@@@@@@@@@@@@@@@@',
  ':@@@@@@@@@@@@@@.=+........=..@@@@@@@@@@@@@@@@@@... ... ......@@@@@@@@@@@@@@@@.........  .@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '...@@@@@@@@@@@@@..............@@@@@@@@@@@@@@@@@.............@@@@@@@@@@@@@@@@...........@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '....:@@@@@@@@@@@@@.............@@@@@@@@@@@@@-@@....... . @..@@@@@@@@@@@@@@@..........*@@@@@@@@@@@@@@@@@@@@@@@@=....',
  '......:@@@@@@@@@@@@@.... .......@@@@@@@@@@@@@.@*.........@.#@@@@@@@@@@@@@@.. .......@@@@@@@@@@@@@@@@#..@@@*........',
  '....... .@@@@@@@@@@@@...........:@@@@@@@@@@@@..@........:@.@@@@@@@@@@@@@@.........@@@@@@@@@@@@@@@-. .@@............',
  '...........@@@@@@@@@@@@........ .#@@@@@@@@@@@@..........#@*@@@@@@@@@@@@@......=.#@@@@@@@@@@@@@#....................',
  '............:@@@@@@@@@@@@.........@@@@@@@@@@@@..........@@@@@@@@@@@@@@@......@@@@@@@@@@@@@@@.......... ........ ...',
  '.. ...........@@@@@@@@@@=*......@..@@@@@@@@@@@@.........@@@@@@@@@@@@@@.... .@@@@@@@@@@@@@@....... .. .......%@@@@@@',
  '@..... .....-@@@@@@@@@@@@@.......@@.@@@@@@@@@@@.........@@@@@@@@@@@@@......@@@@@@@@@@@@@...........@@:.@@@@@@@@@@@@',
  '@@@=..........*@@@@@@@@@@@@+.. ...@@@@@@@@@@@@@:........@@@@@@@@@@.@@.....@@@@@@@@@@@#.........@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@..... ....*@@@@@@@@@@@@......@@@@@@@@@@@@@........@@@@@@@@@%.@ ....@@@@@@@@@.*.......#@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@.........*@@@@@@@@@@@- ....@@@@@@@@@#@#........@@@@@@@@@......:@@@@@@@@. ......-@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@-........*@@@@@@@@@@@.....@@@@@@@@@.*......*.@@@@@@@@@......@@@@@@@.... .@.@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@........+@@@@@@@@@@.. ..@@@@@@@@@.......@.@@@@@@@@......@@@@@@@.....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@%...........@@@@@@#%@.....@@@@@@@@.......@@@@@@@@@@.....@@@@@@.....@@@@@@@@@..@@@@@+..........==@@@@@@',
  '@@@@@@@@@@@@@@@@..........+@@@@@@.......@@@@@@@@......@@@@@@@@@.....@@@@@@....@@@@@@@.......... .............%@@@@@',
  '@@@@@@@@@@@@@@@@@@+......@@@@@@@@@.....@#@@@@@@@......@@@@@@@@@....@@@@@#...-@@%@%...............................+@',
  '..#@@@@@@@@@@@@@#:@@@. ....@@@@@@@@.....@@@@@@@@=.....@@@@@@@@....+@@@=....%@................+%%*..................',
  '.....@@@@@@@@@@@@@@.. .......@@@@@@@....:@@@@@@@@.....@@@@@@@% ...@@@:. ..@.......-..-@@@@@@@@@@@@@@@@*............',
  '.....@@#@@@@@@@@@@@@@-.........@@@@@@....@@@@@@@@.....@@@@@@.....@@@...........@@#@@@@@@@@@@@@@@@@@@@@@@@@@........',
  '........@@@@@@@@@@@@@@@@.........@@@@@....+@@@@@-#....@@@@@@....@@@.........*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.....',
  '...........@@@@@@@@@@@@@@@.... .. @@.@@....@@@@@@.....@@@@@@....@@-. .....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.% ..',
  '@@@=..........@@@@@@@@@@@@@@@.......@.-@...=@@@@@....#@@@@@... @@.......@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@% ..',
  '@@@@@@@..........@@@@@@@@@@@@@@.........=...@@@@@@...@@@@@@....@.....@@@@@@@@@@@@@@@.............@@@@@@@@@@@@@@@@..',
  '@@@@@.#%@@..........@@@@@@@@@@@@@............@@@@@...@@@@@@...@.. ..@@@@@@@@@@@@...................*.@@@@@@@@@@@@..',
  '@@@@@@@@-.  .........:@@@@@@@@@.:@@..........%@@@@...@@@@@........@@@@@@@@.@=. ....::%@@@%#...........@@@@@@@@@@@@.',
  '@@@@@@@@@@@@............#@@@@@@@@.........:@..@@@+@..@@@#@.......@@@@@@@.......%@@@@@@@@@@@@@@.-........@@@@@@@@@@.',
  '@@@@@@@@@@@@@@@.. .........@@@@@@@@........:@@.@@@...@@@.+... .#@@@@@@.. .@+@@@@@@@@@@@@@@@@@@@@@..... ..@@@@@@@@@.',
  '@@@@@@@@@@@@@@@@@@...........:@@@@@@@.......-@@@@@...@@@......@@@@@@:..*@@@@@@@@@@@@@@@@@@@@@@@@@@+......@@@@@@@@@.',
  '@@@@@@@@@@@@@@@-...:#...........@@@@@@@:......@@@@@...@@.... %@@@@@..%@@@@@@@@@@@@%@@@@@@@@@@@@@@@@+.....@@@@@@@@@.',
  '..+@@@@@@@@@@@@@@@@...........@@@@@@@@@@......@@@@...@@.. ..@@@-..:@@@@@@@@...++#%@@@@@@@@@@@@@@@@:.....@@@@@@@@..',
  '.......@@@@@@@@@@@@@@@@..........@@@@@@@@+@.....@@@*..@*....@@@+.@@@@@@@*...............@@@@@@@@@@@@....#@@@@@@@@.',
  '........::=@@@@@@@@@@@@@-..... ....%@@@@@@@:.....@@@..-....@@@@.@@@@@.. ..++@@@@%......:@%%@@@@@@@@@....@@@@@@@:...',
  '..........@@@@@@@@@@@@@@@@@@:.........@@@@@@@.....%@.......@@@.@@@@....+@@@@@@@@@@@@=....@@@@@@@@@@:...#@@@@@@@ ...',
  '..............+@@@@@@@@@@@@@@@@@........@@@@@@@....=@.....@@@.@@@@...@@@@@@@@@@@@@@@@@... @@@@@@@@@.  .@@@@@@@.....',
  '.. ................@@@@@@@@@@@@@@@@:......-@@@@@. ........@@@@@@...@@@@@%..*@@@@@@@@@@.....@@@@@%@...+@@@@@@@......',
  '@@@@@#...... ....... ..@@@@@@@@@@....=....+..@@@@+........@@=@@# .@. . .....:@@@@@@@@@. ..@@@@@@@%..%@@@@@@@......@',
  '@@@@@@@@@@@@@%........:@@@@@@@@@@@@@........@@@@@@@......#@@@@@.....-@+#.....@@@@@@@@%....@@@@@:@..@@@@@@@@......@@',
  '@@@@@@@:................@@@@@@@@@@@@@@@@.......@@@@@:.....@@@@....@@@@@@@@....%@@@@@@.....@@@@.@@+@@@@@@@......%@@@',
  '@@@@@@@@@@@@@@%...... .... ..:@@@@@@@@@@@@@*......@@@*....@@@@..:@....-@@@@...*@@@@@@....@@#@-@@@@@@@@@@.....+@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@=...........:@@@@@@@@@@@......+@...@@@@...%@.@@..@@@....@@@@:....=@.@@@@@@@@@@.*.....@-@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*........=@@@@@@@%..........:@@*.....@...@@@...-@@@@.......@@@@@@@@@@........@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@:...............:@@@%=........%@@@@@*...@@@...@@@@@.......@@@@@@@@@........@@@@@@@@@',
  '......  .. ......%@@@@@@@@@@@@@@@@@@@@@@@@%:..... .................. .%@@...@@@@%.......@@@@@@@@@:......@@@@@@@@@@@',
  '............=%%%@@@%@@@@@@@@@@@@@@@@@@@@@@@@@@%@@%#-............ ...@%@=. .#@@@@......@@@@@@@@@@......@@@@@@@@@@@@@',
  '.................. .. ............#@@@@@@@@@@@@@@@@@@@@@@@+-....:%@@@.. ..@@@@:. ...:@@@@@@@@@.... .@@@@@@@@@@@@..',
  '................................+@@@@@@@@@@@@@=@@@@:........@@@@@@@% ..#=@@@@..  ..%@@@@@@@@.....:@@@@@@@@@@@@@@+..',
  '%%%%%%%%%%%%%... ...:@%%%%%%%%%%@%%@%%@..............:.@@@@@@@@%@*...%%@@@@:......@@@@@@@@... .@@@@@@@@@@@@@@*.....',
  '%%%%%%%%%%....:@%%%%%%%%%%%%%%##%=.. .. ........+%@@@@@@@@@@%@.. ..%@@@@@:......@@@@@@@%.........@@@@@@@@@.........',
  '%%%%%%%%%%%%%%%%%%%%%%%##%............ .:%%%%%@%@@@@@@@@@@%......@%@@@%@......@@@@@@%... .... @@@@@@@@@............',
  '%%%%%%%%%%%%%%%%%%%%%%%.............#%%%%%%%%%%%%%%%@%%*%......*%@%%%%......*%@@@@%. ......%@@@@@@@@@@%%........ .#',
  '%%%%%%%%%%%%%%%#:%%........... ..%%#%%%%%%%%%%.%%%%%@......:.%%%%%%%.......@%@@@%%......@%%%%%%%@%%%%.........:@@@@',
  '%%%%%%%#####+.... ...........:..+#%%%%%%%-%..%%%%%. ... .%.%%%%%%%......=%%%%%%@.. ...:%%%%%%%%%%%.........%%%%%%%@',
  '########*...........@........####%%###-....###%%......#%%%%%%%%%......#%%%%%%......=%%%%%%%%%%#.........:%%%%%%%%%%',
  '######.........:+@@@@@@@@%.*#######*.....####:.... .%%%%%%%%%%......#%%%%%%.+%..%%%%%%%%%%%.... ....#%%%%%%%%%%%%%%',
  '**#+...............@@@..=+*#####*. ....:*##......=#%%%%%%%=%.. ...%%%%%%=%%*#%%%%*%%%%%%...... .:%%%%%%%%%%%%%%%%%%',
  '*................==@@%-+**#**#*.......**-.......########.......:##%%#%%%#%%%%%%%%%###.............:%%%%%%%%%%%.....',
  '..............***+=@@@++*****........+.......*########.......=#-.#############*#*........ ....*##############... ..',
  '............++++++.@@#+++*+........-......**######*+..........:*#######******+. ..........##############...........',
  '.. .. .*+:**+==-++*@@@.:+......... .....*********+..........**********=:**............***###############...........',
  '.....******+-..=++@@@@*...............+*****:.*:.........=+********..............-********##*#*#***.............-##',
  '..+**++++++....:@@@@@@@@@...........+++++*............+********:.................***********+......... ............',
  '++++++++=....@@@@@@@@@@@@@........+++++.............*********... ...........:****************+........  ......#####',
  '+++==.=....@@@@@@@@@@@@@@@@... .====....... .....=+++++..+..............++********++++.......................*#####',
  '==-.......@@@@@@@@@@@@@@@@@...---........... ..====................-+++++++++++==:........ ..........*+*********###',
  '-.....%@@@@@@@@@@@@@@@@@@@@..:-.............:---.................:==========++:...............-=++++++++++++++****=',
  '....:@@@@@@@@@@@@@@@@@@@@@@@......... ....--.................=-----....=..........  ...+======-----======:..:=+++++',
  '...#@@@@@@@@@@@@@@@@@@@@@@@@%...........:.................::...................:========----:..#:.........:--======',
  '..#@@@@@@@@@@@@@@@@@@@@@@@@@@............................................:...................@@@@@@................',
  '=@@@@@@@@@@@@@@@@@@@@@@@@@@@@............................................... ...............@@@@@@@@-......... ....',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.=+++++++++++++++++-.......=+-+++-..:...=-.+++...:+...........@@@@@@@@@@-.............',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.=+++++++++++++%%%%%+#%%%%%%#+++++++*#####++++****+*++++=--.@@@@@@@@@@@@.-==+++++++++',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@:==++++++++++%%%%%%%%%%%%%%%%%%###############=======+++=:.@@@@@@@@@@@@@@.:-=++=**#*#',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.*##+++++%%%%%%%%%%%%%%%%%%%%%%%%===+++++*+****++..... ...@@@@@@@@@@@@@@%......@%%%%',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%....-%%%%%%%%%%%%%%%%****+++******===...................@@@@@@@@@@@@@@@@%=.........',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%%%%%%%%%%%%%%%%%%%%@..... .......... ...........:@@@@@@@@@@@@@@@@@@@@@@... ..',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+........ . ...............@@@@@@@@...............@@@@@@@@@@@@@@@@@@@@@@@@@@@@@...',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@. ............ ...... .@@@@@@@@@@@%%.. .....%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@......................-#@@@%%%@%%@%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.%@%.............................%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.@@@...%%@................ ...... ........%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.%.@@%........................................*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.%%%@@%%%...........................................:*@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.........................................=%@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@@@%%%..... ..........................................-*@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@%@@%%%%%%%+@@@........@@...............................=@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%%%%%%@@@@@@@@:....@@........:@@%=................... ....-@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@=*........@@@@@@@.....@@........@@@@@.............%%%%.:%%..%%...@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@:..@@@@@@@.. +@@@+.......@@@@@.......:%%%%%%%%%%%%%%%%%%%%%',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.@@@@@@@. .#@@@+@@@@#..@@@@@...=%%%%%%%%%%%%%%%%%%%%%@@@%',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@@@@@%@@@=@@@@#..@@@@@....@%%%%%%%%%%%%%%%%%%@@@@@%',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@=@@@@*.-@@@@@-@@@@....@@@@%%%%%%%%%%@@@@@%',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@=@@@@....@@@@%%%%%@@@@@@@@@@%',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@@@@@@=@@@@@@@@@@@%@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%@@@@@@@@@@@%@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
].map((s) => s.padEnd(RIO_DIMS.cols, ' '));

// ---------------------------------------------------------------------------
// FLASHBACK 2 — mirror-life leak. Density-mapped ASCII reproduction at
// 115×103, matching the Rio Miyake style: static, monochrome, single-layer
// woodcut. The image-to-ASCII glyph ramp encodes pixel intensity directly.
// ---------------------------------------------------------------------------

export const MIRROR_LEAK: string[] = [
  '.........................@*#######@...........................................%#######+@.........................',
  '.......................@-#######%:......................+......................-%####**#**%......................',
  '....................@++***####%:..................:.....#.....*..................:%*********@....................',
  '..................@-++*****@@.....................+.....%.....*.....................@%*******.@..................',
  '................@:-+++***%@.......................@.....@.............................@%+***++*##:...............',
  '..............@:---+++%%@%@.......................%.....@.............................@%%%%++++*##%..............',
  '............@:**---=@%@@@@@%@.................%...-.....%....-......................@+@@%@%@%.+***##@............',
  '...........+**+=-:%@..@@@@%%%++:..............:.........%....#...%................++@%%%@%@..@%=***##+#..........',
  '.........%.***+:%@......:@%%%%%++..................:....#....#...*..............+=%%%%%%+......@%+*####@.........',
  '........@*****%%...........@%%%%%+@............+...#....*....#................@=@%%%%@...........@%-####@........',
  '.......#****%%@*@@@@@+=......@####+=#.......-..%...-....=....#..+...........-=-%%%%@......:=*@@@@@@%%###%@.......',
  '.......****%@#########%@==***#*#**@@=@.........#...:...@=....-..#..:.......@-@@-:--------******#####@%*#%%.......',
  '......@***%@................::=*%%%#%=@............#...:%@..-...#..%......@-@%%@@+=-.................@%*%%@......',
  '......%**%@.......................@##@-@.....@..#..@..-.-+#.%...+........%-@%%@.......................@%*%#......',
  '......*#%%.........................@##--.....%..=..%+#..--::*.....:......--%%@.........................@%##......',
  '......**%@##+-=-...............:..:.%#:-%.......%..@+@-----.*@.=..%..+..#-:%%:::::::::............::=+*%%%#......',
  '......#%%@++++++*****###%############%--@..%..+.#..:.@---=+@.-.+..#..:..@:-@#############@************#%%%#......',
  '......@%%@@:........................-@-%@.....%..=*..%:+-*.---=+........@#-@-.........................%@%%@......',
  '.......%%%%@-.......................@-+%@.....%...+..---=.----:*.#..%...@#=-%........................%%@%%.......',
  '.......@%@@%%@.....................:--%%%...%.:..:.=----@--@+=.%.*..%...###.--.....................@%%%@%@.......',
  '........@%@#%%#:..................@-%%%%....@..@.@.@--@-@#-++@:=.%.......%##*-@:..................%%%%#%@........',
  '.........@%############%=##*****#=-%%%%:.......+.%:*.=+=@-+@:--:.=.%..-..:###*-+####*****%#########@#%%@.........',
  '...........%%#%@@@@+++*+-#####%@-##%%%=...*..#.@.@..--+@+@=:-%+.#..#..*...-*****=@%###**-+**++@@@@%#%%...........',
  '............@%#%%%@%@........@-####%%.....#..%.:==:..--%=+---+=:-..-........%*****=@........@*%%%%#%@............',
  '..............@%#%%%%%#:...@-######@.........#.:..@-.#--@.--:+-:-.#..#.......@******=@....##%%%%#%@..............',
  '................@%%%%%%%*@-######@.........#..=.@:=-=---@*-=++@-..#..%.........@******-@=%#%%%%%@................',
  '..................-%%%%+:######%...........%..=.+:-:@-=+@++=@---..#..............@******=+%%%%=..................',
  '....................#-****###@.............:..@.+..---%*+=@:--+-.*..#..............@#*******@....................',
  '..................@-+*****%@@@%@............#.+=.:..--:@+@.---++.=..#..@.........@*@@@%*******@..................',
  '................@--++***%@@@@@@@*@.......@..%....@=.:--=@.*---=@:%.............@+@%%%@%@%=*****+@................',
  '..............+:---=++%%...@%%%%%*+@........*..%@--=-%-=@:---+#.%..#..*......*++%%%%%@...%%=***##*@..............',
  '.............#+=--=+%-.......*%%%%%=@.....=..%.#:.@==-*=%#--+@@:%..#..#.....@=%%%%%#.......-%%**####.............',
  '...........@=+++-#%:...........@#%%%-=....%..+..-::.*=++@=+@-.-+@.-:.......--%%%%@............%%#####@...........',
  '..........@**++=%%#####%#@*****#****#-=...:..@:.*.+-#.@@+@@.#-%+@.*..#....--%----------#*#***##%%%####@..........',
  '.........****=%@.................:@%##=#...%....@-=.--:@+@.--++-@.%..*...=-%%%@.............:::--@%*###%.........',
  '........#***@%:....................@##@-%..%..+:=-=.:--=@.---:+%.#..*...@-@%%%.....................%%###@........',
  '.......@***%@.......................@#@-@..-..@%=@==:@-+@----+=:*%..#...@-%%@.......................@%###@.......',
  '.......***%@.........................#@-@...-..@..@==--=%*-=+@#:=@..:...#-@%.........................@%###.......',
  '......@**%@-=++*********@#############::%:..#..@::-.@===@=+@:.-%--.#..+.#-@#############@.:::::::::-+=@%###......',
  '......@*%@.........:::-..---===-==+++@-%%...*-.@.:.--:@@+@@.--*+-..%..-:*#-@****++++**+*.-###%@@@@@@@@@%%#@......',
  '......@*%@..........................@-%%@.*....*--.:---@+@.----+@.@.....@#+-@.........................*@%#@......',
  '......@%%@@........................@-%%%=.=..@-.@=:-%--*@.----++%.%..%..@###-@........................@@%#:......',
  '.......%%%%@.....................+-:%%%@...:..:=.#=--%-=@----++@%=.......@###-+......................@%@%@.......',
  '.......@%@%**********##@*******+*-##%%@....%..@:.@@==--+#*-:+=@--@..*.....%##*#-@*******##**********##%@%+.......',
  '........@%%@@@@@@@@@@@@#@@@@@@@-#####@.........+:-.-@=+=@===@.--=@..+......@#***==@@@@@@@@@@@@@@@@@@@%#%@........',
  '.........@%#%@@@............@-######-.......:.:@-.-+:%@@*@@.---=-+.*..#.....@******=@............#@%@%%@.........',
  '..........@%#%%@@@.......-=:######@.......:.+-.@:..---=#+@.#--*==..#..........@******=@:.......%%@@@%%+..........',
  '............%%#%%%%%...@-#######@.........-..-..==.:---@@.@--%+=@.-..%..........%******:*=..=+%%%%#%@............',
  '.............-%%%%%%%@=#######@............:.*.@@=+----=@---@-=@.@#...............@********@%%%%%%@..............',
  '...............:%%%@:***###%@..............%..%:-@-=-+-+=%-*=+@@:@..#..............:@#******+@%%@................',
  '.................@.=+****%@:.............-..:.-:.%.@==*=@===@-.-+@..+.................@%*******@.................',
  '...............@:--=++%%@@@%%...............@..*-.-#.@=@*=@:.--*+@.#..*............=**@%@%:******@...............',
  '.............@:+--==@@@%@%%%%++=..........%..-.@-.:---@@+@.*--=+=..#.............@+=%%%%@%@%%***##*@.............',
  '...........:-*+=--%@....@@%%%%%++=...........%.=:+::--*@@.#---=+@.=..%.........@++%%%%%%@....%@**####............',
  '..........@***+=%@........-%%%%%%+*........%...-@-=::--+@:----+#.@#...........==%%%%%@.........%@*####@..........',
  '.........@****@%:...........:@%%%%@=@......-..@::@+=---+=#--++@@-@..#.......@=@%%%%@............=%#####@.........',
  '........@***=%#-+***###@-::::::-::@#=@......#.:%.-:@+++=%==+%@.-+@.........=-%%:--:-:---+@***#####@%####@........',
  '.......@***%%##########%=====++====%#=*.....#..@-.-=.@=@%-%*.+-*=:.#......--%%=+=======+############%%####.......',
  '.......***%@......................@%##=@.......@:..--:@#+@.----+=.:......=-%%%@......................%%###.......',
  '......@**%@........................@##@-=....%:.--:----@@:+--:++@.#.....@-@%%@.......................:%@##=......',
  '......@#%%..........................@#@-@..=....@=--:--=@:---=+@.*..=..:--%%@.........................%%##@......',
  '......@*%@%##++*++++++=:.====+======+%@-@.....%=-@==-%-+-%--=+@@:%......-=%@+++++++++++=.==+++++++++++@@%#@......',
  '......@#%@+++++++******#%#############@-%:..%..@:-:@+=+=*+-+#@.==:.#...##-@#############%************%%@%#@......',
  '......%@%%%@.........................%-%%....-.@..-=.@+@@-@-.=-+%..:...##:-@.:.......................@%@%*.......',
  '.......%%@%%@.......................:-:%@....@.*::.---@%+@.%--=+*.*.....##-@:.......................@%%@%@.......',
  '.......:%%%%%@......................-:%%@.......@-.:---@@.%---++:#......@##-%......................@%%%%%........',
  '........@%%%%@#@..................@-%%%%......-+.==----=@----+++:%......=###:-...................@#%%#%%.........',
  '.........-%%###########*%#####*##=-%%%%-.......%=:+=-=-=:*--++@@@........@####-@####***############%#%%..........',
  '...........@%#%@@@@#**##.%%@@@@@-#%%%#=........::=:@==#=%-=+@-:=@.........@##**.=@@@@@%#:%%#*%@@@@##%@...........',
  '............:%%#%@@%##.......@-###%%%...........*.:@.@%@*+@.=---:..........+*****.=%.......%#%%%%#%@.............',
  '..............*%#%%%%%#@...@-######@............@-..---@+@.---+@.............@*****:=@...@*%%%%%%%...............',
  '................-%%%%%%%*@-######@...............%*::--@@.---++................%******+@+%%%%%%@.................',
  '...................@%%%=:######@..................@=---=-#-:++:.................=%******-@%%%@...................',
  '....................*-***####@@....................@==-=#:++@.....................@%*******%.....................',
  '..................#-*****#%@@%##@....................*@++@@-....................@*%%@%********:..................',
  '................@-=++***%@@@%@%%++=..................@-%=-+...................@+@%%%%@%@@******#.................',
  '..............*:===+*+%@...@%%%%%@+@.................#---+@.................*++%%%%%@....@%*****#%...............',
  '.............=+====+%+.......+%%%%%==+................:--+%................@+@%%%%@........@%+***##@.............',
  '...........@*++=-#%-...........@%%%%@=@...............+:-+-...............==%%%%@............@%+*####+...........',
  '..........***+++%#+*#####%-----:::::@@=@..............#.-+:..............-=%.:....::::=#---=-##@%*####@..........',
  '........=****=%@@@@@@@@@@@@@@@@@@@@@@%+-:.............#.-+:.............@=%%%@@@@@@@@@@@@@@@@@%%%%%####@.........',
  '.......:****%@.....................@#%#-@.............#.-+:............%-@%%@.....................@%*###@........',
  '.......****%@.......................@##:-.............#.-+:............@-@%%........................%@###%.......',
  '......@***%=.........................%%:-@............#.-=:............+-%%+........................:%%##@.......',
  '......%#*%@@@@@@@@@@@@@@.@@@@@@@@@@@@@#=-@............#.-=:............#-@@@@@@@@@@@@@@@%@@@@@@@@@@@@@%%##.......',
  '......*#%@*****########%@%%%%%%%%%%%%%@-%@............#.-=:............#=%%%%%%%%%%%%%%@##############@%##:......',
  '......*@%@-..........................@-=%@............#.-=:............#%-@.........................:.%%%#.......',
  '......@%%@@.........................:-:%%.............*.-=:............@#--@.........................@%@%%.......',
  '......@%%%%@.......................=-:%%@.............*.-=:............@##:-@.......................@%%@%@.......',
  '.......@%%%%%:....................@-%%%%:.............*.-+:.............%###-@.....................#%%%%@........',
  '........%%#%###+++==---#-========:-%%%%%..............*.-+:..............####-:-====++*#@:++++*#####%%%%.........',
  '.........%%#%@@@@@@@@@@@@@@@@@@%-#%%%%%...............*.-+:...............*##**-@@@@@@@@%@@@@@@@@@@@#%%..........',
  '..........@%#%%@%%+..........@-###%%%.................*.-+:................@*****=@:.........=#%@@%#%@...........',
  '...........%%%%%%%%#@......#-######@..................*.-+:.................@******=@......#*%%%%#%%#............',
  '.............@%#%%%%%*@.*:.######@....................*.-+:...................@******.=*.@*%%%%%%%@..............',
  '...............@%%%%%%@=#######@......................*.-+:.....................@*******+@%%%%%%@................',
  '.................#%%@-*######@........................*.-+:.......................@*******+@%%*..................',
  '..................*:***###%@@.........................*.-+:........................@@@*******#:..................',
  '...............--=+****#%@@@@%%:......................*.-+:......................@*@%@@%=*****#*+................',
  '..............===++**=@@%@%%%@@+*.....................*.-+:....................@+@%@%%@%@%****###*-..............',
  '............@-+==+*@%%....@%@%%%@+@...................*.-+:..................@+#%%%%%@....*%@**####@.............',
  '..........@:++===@%*........@%%%%%++-.................*.-=:.................*+@%%%%@........=%@######@...........',
  '.........@**++=%%@............@%%%%*+@................*.-=:...............+==%%%%@............%%@#####@..........',
  '........@***+=%@................@%%%%+@...............+.-=:..............%==%%%%-...............@%*####@.........',
  '.......@****@%@#########@-----------%=+@..............+.-=:.............=*=%:---------:+:++*****#%%%###%@........',
  '......+#***@%@@@@@@@@@@@+%%%%@@@@%%@%%+%+.............*.-+:............:*=@%@@%@%%@%%%@@@@@@@@@@@@@%%##%%@.......',
  '......@#**@%%......................@%%@+%.............+.-+:............@#=%%@......................=%%%%%%.......',
  '......#***%@........................%%%=%-............+.-+:............*=@%%........................@%*%%%:......',
  '......***@%@---------------------::.-@##%@............+.-+.............*#@@#------------------------*%%%##*......',
  '.................................................................................................................',
].map((s) => s.padEnd(MIRROR_DIMS.cols, ' '));

// ---------------------------------------------------------------------------
// EMBER FALL — a single * glyph traces a path from the Hearth's apex down
// into the apprentice's bronze vessel, kindling the new Cinder. Arc from
// the upper-right of the hearth fire over and down into the cinder vessel.
// ---------------------------------------------------------------------------

export const EMBER_FALL_FRAMES: string[][] = Array.from({ length: FRAMES }, (_, t) => {
  const grid = blank(C_ROWS, C_COLS);
  const u = t / (FRAMES - 1);
  const startRow = HEARTH_FIRE_TOP + 1, startCol = 30 + CAMP_OFFSET;
  // Land at the vessel's centre column so the ember visibly arcs into it.
  const endRow = CINDER_VESSEL_ROW,     endCol = CINDER_VESSEL_COL + 2;
  // Slight upward arc mid-flight (the spark leaps before falling).
  const row = Math.round(startRow + (endRow - startRow) * u + Math.sin(u * Math.PI) * -3);
  const col = Math.round(startCol + (endCol - startCol) * u);
  if (row >= 0 && row < C_ROWS && col >= 0 && col < C_COLS) grid[row][col] = '*';
  return gridToArt(grid);
});
