// The Cinder model (DESIGN.md §2, §3, §8) — the Circle.
//
// One *bonded* Cinder (a voice, bond memory, a grievable permadeath) plus a
// circle of *unbonded* wild-kindled fires (expendable, trait-bearing). Traits
// are deterministic from the fire's name (name -> seed -> fixed fire), so a
// named fire is reproducible and shareable, matching the RNG philosophy.
//
// Feeding is performing Readings (§3): every Reading sustains the fire; a
// stretch with none starves it; a contradicted call forces it to expel noise
// at extra cost (bible §8); sustained feeding reaches burn-bright (bible §13).

import { Rng, seedFrom } from "../rng";
import type { FireManner, FireReadProfile, SpectralType } from "./reading";

const SPECTRALS: SpectralType[] = ["amber", "azure", "ashen"];
const MANNERS: FireManner[] = ["confident", "cautious", "histrionic"];
// Visual identity is the procedural pet art (src/core/petart.ts), derived from
// the Cinder name — there is no separate per-fire flicker glyph anymore.

// --- tuning (feel-tuned, never surfaced) ----------------------------------

const VIT_START = 0.7; // a fresh ember is warm, not full
const FEED_GAIN = 0.055; // one Reading
const PASSIVE_DECAY = 0.02; // even a tended period costs a little
const NEGLECT_DECAY = 0.2; // a period with zero Readings
const NOISE_COST = 0.065; // a contradicted / wrong call
const REST_GAIN = 0.4; // a camp rest restores this much vitality (partial)
const BURN_BRIGHT_STREAK = 3; // fed periods in a row to reach the high state
const BURN_BRIGHT_BUMP = 0.16; // acuity boost while burn-bright

// Progression: XP is earned ONLY from battles (DESIGN.skills §9 — the
// finalizeBattle grant); a Reading no longer trickles XP. Levelling sharpens
// the fire (a permanent acuity gain, capped) on top of transient burn-bright.
const LEVEL_MAX = 12;
const LEVEL_ACUITY = 0.016; // acuity per level above 1 (→ +0.176 at L12)
function xpToNext(level: number): number {
  return 4 + level * 3; // L1→7, L2→10, L3→13, …
}
const STAGES = ["spark", "ember", "flame", "blaze", "pyre"];
export function cinderStage(c: Cinder): string {
  return STAGES[Math.min(STAGES.length - 1, Math.floor((c.level - 1) / 3))];
}
export function xpProgress(c: Cinder): { level: number; xp: number; need: number; frac: number } {
  const need = xpToNext(c.level);
  return { level: c.level, xp: c.xp, need, frac: c.level >= LEVEL_MAX ? 1 : c.xp / need };
}

export interface Cinder {
  name: string;
  bonded: boolean;
  // Deterministic traits (from seedFrom(name)):
  spectral: SpectralType;
  manner: FireManner;
  baseAcuity: number; // 0..1
  // Progression (grows with use; persists for the fire's life):
  level: number; // 1 .. LEVEL_MAX
  xp: number; // toward the next level
  // Mutable state:
  vitality: number; // 0 dead .. 1 full
  // Battle wear that PERSISTS run-wide (DESIGN.md §8): the fire's current
  // coherence as a fraction 0..1 of its max. Damage carries between fights;
  // camp rest restores it to 1. A fire at 0 is benched (can't be fielded).
  coherenceFrac: number;
  streak: number; // consecutive fed periods
  _fedThisPeriod: boolean;
  // Bond layer — bonded fire only; circle-fires never accrue this.
  bond: number; // 0..1
  memory: string[]; // notable shared moments
  // Skills taught by the ancient fire (move ids beyond the two implicit
  // starters). Run-scoped — a fresh kindle knows none (DESIGN.skills §3).
  skills: string[];
}

export function kindle(name: string, bonded: boolean): Cinder {
  const rng = new Rng(seedFrom("cinder:" + name));
  const spectral = SPECTRALS[rng.nextInt(SPECTRALS.length)];
  const manner = MANNERS[rng.nextInt(MANNERS.length)];
  const baseAcuity = 0.55 + rng.nextFloat() * 0.4; // 0.55 .. 0.95
  return {
    name,
    bonded,
    spectral,
    manner,
    baseAcuity,
    level: 1,
    xp: 0,
    vitality: VIT_START,
    coherenceFrac: 1, // a fresh ember is whole
    streak: 0,
    _fedThisPeriod: false,
    bond: 0,
    memory: [],
    skills: [],
  };
}

export function isAlive(c: Cinder): boolean {
  return c.vitality > 0;
}

export function isBurnBright(c: Cinder): boolean {
  return isAlive(c) && c.streak >= BURN_BRIGHT_STREAK;
}

// Call once per Reading the fire performs. A dead fire cannot be fed (it needs
// a new ember — the run loop handles replacement, not this model).
export function feedReading(c: Cinder): void {
  if (!isAlive(c)) return;
  c.vitality = clamp01(c.vitality + FEED_GAIN);
  c._fedThisPeriod = true;
  // No XP here — XP is battle-only now (DESIGN.skills §9). Reading still feeds
  // vitality and the burn-bright streak.
}

// Practice XP; rolls over into levels (capped). Levelling is a permanent
// acuity gain surfaced in the encounter sheet.
export function gainXp(c: Cinder, n: number): void {
  if (!isAlive(c) || c.level >= LEVEL_MAX) return;
  c.xp += n;
  while (c.level < LEVEL_MAX && c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level += 1;
  }
}

// Call when a call is contradicted / proven wrong: the fire must expel the
// noise it took in, at a cost beyond an ordinary period (bible §8).
export function expelNoise(c: Cinder): void {
  if (!isAlive(c)) return;
  c.vitality = clamp01(c.vitality - NOISE_COST);
}

// Close a camp/day period. Fed periods build the streak toward burn-bright;
// a neglected period decays hard and breaks the streak.
export function endPeriod(c: Cinder): void {
  if (!isAlive(c)) return;
  if (c._fedThisPeriod) {
    c.streak += 1;
    c.vitality = clamp01(c.vitality - PASSIVE_DECAY);
  } else {
    c.streak = 0;
    c.vitality = clamp01(c.vitality - NEGLECT_DECAY);
  }
  c._fedThisPeriod = false;
}

// A camp rest (the hub recovery beat — DESIGN.md §4 loop). Replaces the
// neglect/decay period at camp: a living fire RECOVERS vitality toward full
// (partial — REST_GAIN, not a full heal of the mana budget, so over-extending
// still wears the Circle down) and builds its streak. Battle wear is healed
// FULLY here (coherenceFrac → 1): lasting cost is only within a camp-to-camp
// stretch (DESIGN.md §8). A snuffed fire (vitality 0, e.g. a staked loss) is
// NOT revived — the caller memorialises / drops it.
export function restPeriod(c: Cinder): void {
  if (!isAlive(c)) return;
  c.streak += 1;
  c.vitality = clamp01(c.vitality + REST_GAIN);
  c.coherenceFrac = 1; // camp fully restores battle coherence
  c._fedThisPeriod = false;
}

// A shared moment. Only the bonded fire remembers and deepens; circle-fires
// are tended, not bonded — they accrue nothing here.
export function rememberMoment(c: Cinder, moment: string): void {
  if (!c.bonded || !isAlive(c)) return;
  c.memory.push(moment);
  c.bond = clamp01(c.bond + 0.08);
}

// Map the Cinder's live state to what the Reading engine consumes. Burn-bright
// lifts effective acuity (sharper Readings, bible §13); the engine never sees
// the Cinder type itself.
export function readProfile(c: Cinder): FireReadProfile {
  const levelBonus = (c.level - 1) * LEVEL_ACUITY;
  const acuity = clamp01(c.baseAcuity + levelBonus + (isBurnBright(c) ? BURN_BRIGHT_BUMP : 0));
  return {
    vitality: c.vitality,
    spectral: c.spectral,
    manner: c.manner,
    baseAcuity: acuity,
  };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
