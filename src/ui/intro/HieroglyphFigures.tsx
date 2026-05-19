// Tribe figures rendered as ASCII pictograms in a DOM overlay layer (one
// font-sized span per figure; pose A/B drive the dance swap). The fire /
// smoke / embers / aurora / ground / hearth-pit layers stay untouched —
// only the figures are reskinned. (Originally Egyptian-hieroglyph glyphs;
// swapped to ASCII per the no-unicode rule.)
//
// Three depth tiers around the Hearth fire:
//
//   Row 1 — FRONT  (feet row 48, ~5em):
//     Drummer compound, two main dancers, Apprentice + Tender (right side).
//
//   Row 2 — BACK   (feet row 44, ~4em):
//     Adorers (six figures, three per side) alternating 𓀓 ↔ 𓀢 in a slow
//     dance bob. They sit behind the front-row dancers.
//
//   Row 3 — FAR-BACK (feet row 41, ~3em singles / 2-2.5em compounds):
//     Static onlookers — a single hunter, a single peasant, the BBQ
//     couple, the pair of pregnant women. They don't dance.
//
// Mirror: hieroglyphs are read in the direction the figures face. Most of
// the candidate figures face left by Egyptian convention. Anything whose
// anchor sits left of the Hearth fire is mirrored with scaleX(-1) so it
// looks toward the flames; right-of-fire figures keep their natural
// left-facing posture.
//
// Staging: Tender + Apprentice walk in from the *right* margin during
// walking_to_fire and stop on the right of the flames. They never cross
// the fire — no figure ever overlaps the fire's column range.

import { For, createMemo } from 'solid-js';
import { FRAMES } from './scene-art';

// Hearth-fire footprint in canvas cols. Figures with anchor strictly left
// of this face rightward (mirrored). Anchors strictly right keep their
// natural left-facing posture.
const FIRE_LEFT_CANVAS = 22;

// Bottom row of each tier — the "feet" line. The CSS anchors via
// translateY(0) at row+1, so the glyph renders upward from this line
// regardless of glyph height. Higher tier (smaller row number) = further
// back in screen-space.
const FRONT_FEET_ROW    = 48;
const BACK_FEET_ROW     = 44;
const FAR_BACK_FEET_ROW = 41;

// Tender + Apprentice final positions on the *right* of the fire. The
// Apprentice anchor sits at col 56 so her 5em hieroglyph clears the fire's
// right edge (col 50). The Cinder vessel stays at col 55 — it renders
// below her feet line so there's no visual overlap with her glyph.
const APPRENTICE_COL = 56;
const TENDER_COL     = 65;

const DANCE_HALF = Math.floor(FRAMES / 2);   // 7

// === Walk schedules ========================================================

// walking_to_fire: Tender + Apprentice walk in from off-canvas right.
// Apprentice arrives slightly closer to the fire, Tender trails behind her
// to her right. Both face the fire (no mirror) throughout — their natural
// left-facing posture matches the direction of motion.
const WALK_PAIR_APPR_START   = 78;
const WALK_PAIR_TENDER_START = 84;
const WALK_PAIR_SPEED        = 2;

// arriving: only the front-row left-side dancers walk in. Drummer enters
// first, the two main dancers follow. Back-row + far-back-row figures pop
// in over time on the BACK_POP_INTERVAL schedule.
interface WalkSpec { startCol: number; delay: number }
const ARRIVING_WALK: Record<string, WalkSpec> = {
  'drummer':  { startCol: -10, delay:  0 },
  'dancer-1': { startCol: -8,  delay:  4 },
  'dancer-2': { startCol: -6,  delay:  8 }
};
const BACK_POP_INTERVAL = 4;

// === Figure roster =========================================================
// Glyph pairs (glyphA / glyphB) drive the dance-pose swap on the FRAMES
// cycle, with each figure offset by its own phaseOffset so the dance never
// marches in lockstep. Static figures set glyphA == glyphB and dances=false.
//
// `size` is the em-multiplier for font-size. The size hierarchy supplies
// most of the depth cue; opacity adds the rest via .is-back / .is-far-back.

interface FigureDef {
  id:          string;
  glyphA:      string;
  glyphB:      string;
  col:         number;
  row:         number;
  tier:        'front' | 'back' | 'far-back';
  kind:        'tender' | 'apprentice' | 'tribe' | 'observer';
  phaseOffset: number;
  size:        number;
  dances:      boolean;
}

// 4-row ASCII person pictograms. Pose A = arms out / neutral, pose B = arms
// raised (dance / adoration). Feet sit on the last row in both poses so the
// pose swap animates the arms without the figure jumping.
const P_A = " o  \n/|\\ \n |  \n/ \\ ";
const P_B = "\\o/ \n |  \n |  \n/ \\ ";
// Drummer: a person beside a drum; pose B strikes it.
const DRUM_A = " o []\n/|\\[]\n | []\n/ \\[]";
const DRUM_B = " o []\n\\| []\n | []\n/ \\[]";

// === ROW 1: FRONT (5em featured figures) ===================================

// LEFT side (mirrored, faces right toward fire).
const FRONT_LEFT: FigureDef[] = [
  // Drummer compound — drum 𓇵 paired with a person striking it (𓁄 ↔ 𓀜).
  // Smaller than other front figures because two adjacent glyphs are wide.
  { id: 'drummer',  glyphA: DRUM_A, glyphB: DRUM_B,
    col: 5,  row: FRONT_FEET_ROW, tier: 'front', kind: 'tribe', phaseOffset:  8, size: 3.5, dances: true },

  // Main dancer 1 — alternates 𓀤 ↔ 𓀥
  { id: 'dancer-1', glyphA: P_A, glyphB: P_B,
    col: 12, row: FRONT_FEET_ROW, tier: 'front', kind: 'tribe', phaseOffset:  0, size: 5,   dances: true },

  // Main dancer 2 — alternates 𓀢 ↔ 𓀣
  { id: 'dancer-2', glyphA: P_A, glyphB: P_B,
    col: 18, row: FRONT_FEET_ROW, tier: 'front', kind: 'tribe', phaseOffset:  4, size: 5,   dances: true }
];

const TENDER_DEF: FigureDef = {
  id: 'tender',
  glyphA: P_B,   // arms raised in adoration
  glyphB: P_B,
  col: TENDER_COL,
  row: FRONT_FEET_ROW,
  tier: 'front',
  kind: 'tender',
  phaseOffset: 0,
  size: 5,
  dances: false
};

const APPRENTICE_DEF: FigureDef = {
  id: 'apprentice',
  glyphA: P_A,   // standing youth
  glyphB: P_A,
  col: APPRENTICE_COL,
  row: FRONT_FEET_ROW,
  tier: 'front',
  kind: 'apprentice',
  phaseOffset: 0,
  size: 5,
  dances: false
};

// === ROW 2: BACK (4em adorers, 𓀓 ↔ 𓀢, dancing) ===========================
// Six adorers, three per side — they stand behind the front-row dancers
// and bob between still and arms-raised poses. Phase offsets spread so
// the worship motion ripples through the crowd.

const BACK_TIER: FigureDef[] = [
  // Left side (mirrored).
  { id: 'adorer-bl-1', glyphA: P_A, glyphB: P_B,
    col:  4, row: BACK_FEET_ROW, tier: 'back', kind: 'observer', phaseOffset:  2, size: 4, dances: true },
  { id: 'adorer-bl-2', glyphA: P_A, glyphB: P_B,
    col: 11, row: BACK_FEET_ROW, tier: 'back', kind: 'observer', phaseOffset:  6, size: 4, dances: true },
  { id: 'adorer-bl-3', glyphA: P_A, glyphB: P_B,
    col: 18, row: BACK_FEET_ROW, tier: 'back', kind: 'observer', phaseOffset: 10, size: 4, dances: true },

  // Right side (no mirror).
  { id: 'adorer-br-1', glyphA: P_A, glyphB: P_B,
    col: 54, row: BACK_FEET_ROW, tier: 'back', kind: 'observer', phaseOffset:  3, size: 4, dances: true },
  { id: 'adorer-br-2', glyphA: P_A, glyphB: P_B,
    col: 61, row: BACK_FEET_ROW, tier: 'back', kind: 'observer', phaseOffset:  7, size: 4, dances: true },
  { id: 'adorer-br-3', glyphA: P_A, glyphB: P_B,
    col: 68, row: BACK_FEET_ROW, tier: 'back', kind: 'observer', phaseOffset: 11, size: 4, dances: true }
];

// === ROW 3: FAR-BACK (3em singles / 2-2.5em compounds, all static) =========
// Onlookers minding their own business. They don't move with the ritual.

const FAR_BACK_TIER: FigureDef[] = [
  // LEFT side (mirrored): a hunter and a peasant, single glyphs each.
  { id: 'hunter',   glyphA: P_A, glyphB: P_A,
    col:  5, row: FAR_BACK_FEET_ROW, tier: 'far-back', kind: 'observer', phaseOffset: 0, size: 3,   dances: false },
  { id: 'peasant',  glyphA: P_A, glyphB: P_A,
    col: 14, row: FAR_BACK_FEET_ROW, tier: 'far-back', kind: 'observer', phaseOffset: 0, size: 3,   dances: false },

  // RIGHT side (no mirror): the BBQ couple and the pair of pregnant women.
  // Pregnant-women compound is 4 glyphs wide so it renders smaller (2em)
  // to fit on the right side without spilling off canvas.
  { id: 'bbq',      glyphA: P_A, glyphB: P_A,
    col: 55, row: FAR_BACK_FEET_ROW, tier: 'far-back', kind: 'observer', phaseOffset: 0, size: 2.5, dances: false },
  { id: 'pregnant', glyphA: P_A, glyphB: P_A,
    col: 64, row: FAR_BACK_FEET_ROW, tier: 'far-back', kind: 'observer', phaseOffset: 0, size: 2,   dances: false }
];

// === Roster groupings ======================================================

const ALL_BACKGROUND: FigureDef[] = [...BACK_TIER, ...FAR_BACK_TIER];
const FRONT_DANCERS = FRONT_LEFT;

// === Phase → figure list ===================================================

interface RenderFigure {
  key:     string;
  glyph:   string;
  col:     number;
  row:     number;
  tier:    'front' | 'back' | 'far-back';
  kind:    'tender' | 'apprentice' | 'tribe' | 'observer';
  size:    number;
  mirror:  boolean;
  bob:     'up' | 'down' | null;
  walking: boolean;
}

function isMirrored(col: number): boolean {
  // Anchors left of the fire face rightward toward the flames; right-of-
  // fire anchors keep natural left-facing posture.
  return col < FIRE_LEFT_CANVAS;
}

function toRender(
  f: FigureDef,
  col: number,
  tick: number,
  isDancingPhase: boolean,
  walking = false
): RenderFigure {
  const phase   = ((tick + f.phaseOffset) % FRAMES + FRAMES) % FRAMES;
  const dancing = f.dances && isDancingPhase;
  const useB    = dancing && phase >= DANCE_HALF;
  return {
    key:    f.id,
    glyph:  useB ? f.glyphB : f.glyphA,
    col,
    row:    f.row,
    tier:   f.tier,
    kind:   f.kind,
    size:   f.size,
    mirror: isMirrored(col),
    bob:    dancing ? (phase < DANCE_HALF ? 'up' : 'down') : null,
    walking
  };
}

function computeWalk(start: number, target: number, phaseTick: number, speed: number): number {
  const dir      = target > start ? 1 : -1;
  const dist     = Math.abs(target - start);
  const traveled = Math.min(dist, Math.max(0, phaseTick) * speed);
  return start + dir * traveled;
}

function figuresFor(phase: string, tick: number, phaseTick: number): RenderFigure[] {
  const out: RenderFigure[] = [];

  switch (phase) {
    case 'walking_to_fire': {
      // Tender + Apprentice walk in from off-canvas right. Their final
      // cols are both right of FIRE_RIGHT — no fire-crossing.
      const aCol = computeWalk(WALK_PAIR_APPR_START,   APPRENTICE_COL, phaseTick, WALK_PAIR_SPEED);
      const tCol = computeWalk(WALK_PAIR_TENDER_START, TENDER_COL,     phaseTick, WALK_PAIR_SPEED);
      out.push(toRender(APPRENTICE_DEF, aCol, tick, false, true));
      out.push(toRender(TENDER_DEF,     tCol, tick, false, true));
      return out;
    }

    case 'arriving': {
      // Tender + Apprentice already at their final positions.
      out.push(toRender(APPRENTICE_DEF, APPRENTICE_DEF.col, tick, false));
      out.push(toRender(TENDER_DEF,     TENDER_DEF.col,     tick, false));

      // Front-row left dancers walk in from off-canvas left.
      for (const f of FRONT_DANCERS) {
        const w = ARRIVING_WALK[f.id];
        if (!w) { out.push(toRender(f, f.col, tick, false)); continue; }
        const adjT     = Math.max(0, phaseTick - w.delay);
        const dir      = f.col > w.startCol ? 1 : -1;
        const dist     = Math.abs(f.col - w.startCol);
        const traveled = Math.min(dist, adjT);
        const col      = w.startCol + dir * traveled;
        const stillWalking = adjT > 0 && traveled < dist;
        out.push(toRender(f, col, tick, false, stillWalking));
      }

      // Background tiers pop in one figure at a time, in declared order.
      for (let i = 0; i < ALL_BACKGROUND.length; i++) {
        if (phaseTick >= i * BACK_POP_INTERVAL) {
          out.push(toRender(ALL_BACKGROUND[i], ALL_BACKGROUND[i].col, tick, false));
        }
      }
      return out;
    }

    case 'dancing':
    case 'lore_speech':
    case 'receiving_cinder': {
      // Front-row dancers + back-row adorers dance with phase-offset pose
      // swap. Far-back observers, Tender, and Apprentice stand still
      // (per-figure dances flag controls swap+bob).
      for (const f of FRONT_DANCERS)  out.push(toRender(f, f.col, tick, true));
      for (const f of ALL_BACKGROUND) out.push(toRender(f, f.col, tick, true));
      out.push(toRender(TENDER_DEF,     TENDER_DEF.col,     tick, true));
      out.push(toRender(APPRENTICE_DEF, APPRENTICE_DEF.col, tick, true));
      return out;
    }

    case 'morning':
    case 'test_morning': {
      // Apprentice alone with her named Cinder; the tribe has dispersed.
      out.push(toRender(APPRENTICE_DEF, APPRENTICE_DEF.col, tick, false));
      return out;
    }

    default:
      return out;
  }
}

interface Props {
  phase:     string;
  tick:      number;
  phaseTick: number;
}

export function HieroglyphFigures(props: Props) {
  const list = createMemo(() => figuresFor(props.phase, props.tick, props.phaseTick));
  return (
    <div class="intro-figures">
      <For each={list()}>
        {(fg) => {
          const posClass    = `intro-glyph-pos${fg.walking ? '' : ' is-static'}`;
          const renderClass = [
            'intro-glyph-render',
            `is-${fg.kind}`,
            fg.tier === 'back' ? 'is-back' : '',
            fg.tier === 'far-back' ? 'is-far-back' : '',
            fg.mirror ? 'is-mirrored' : '',
            fg.bob ? `is-dance-${fg.bob}` : ''
          ].filter(Boolean).join(' ');
          return (
            <span
              class={posClass}
              style={{ '--g-col': fg.col, '--g-row': fg.row }}
            >
              <span
                class={renderClass}
                style={{
                  'font-size': `${fg.size / 6}em`,
                  'white-space': 'pre',
                  // ASCII column art needs true monospace + no tracking; the
                  // class font chain is the (now unused) hieroglyph fallback.
                  'font-family': 'ui-monospace, "DejaVu Sans Mono", "Courier New", monospace',
                  'letter-spacing': 'normal',
                  'line-height': '1',
                }}
              >{fg.glyph}</span>
            </span>
          );
        }}
      </For>
    </div>
  );
}
