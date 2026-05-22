// Per-stage modifiers (DESIGN.md §5 — stages distinct, not just labels). The
// bible's 8-stage migration spine has distinct character — Sonoran is dry
// and hot, Sierra Madre is a long winter, Yucatan is mirror-pressure, the
// Andes is the alpha endgame. This module tunes existing systems (rest,
// encounter chance, foe scaling) per stage so the long walk south *feels*
// different.
//
// Single source of truth: STAGE_MODIFIERS is the table; everything else is
// pure accessor. Stage index is the canonical key (matches run.STAGES order).
// PROVISIONAL multipliers — tune from one place.

import { STAGES, type RunState } from "./run";

export interface StageModifier {
  // 1.0 = neutral. Multiplies the encounter chance per travel/cave tick.
  encounterMul: number;
  // 1.0 = neutral. Multiplies the per-camp REST_GAIN and COH_REST_GAIN.
  // Hearth deep-tend is NOT modified — the Hearth is the tribe's pact, the
  // weather is the world.
  restGainMul: number;
  // Added to the level of foes spawned in this stage. Stacks with the
  // latitude-driven base scaling already in battle.makeBattle.
  foeLevelBonus: number;
  // A felt one-liner — the stage's character. Surface in CampScene/CaveScene
  // when entering. No numbers (§1.4 firewall).
  flavor: string;
}

const DEFAULT_MODIFIER: StageModifier = {
  encounterMul: 1.0,
  restGainMul: 1.0,
  foeLevelBonus: 0,
  flavor: "",
};

// Indexed by stage index (run.STAGES order). Missing entries fall back to
// DEFAULT_MODIFIER so the table can grow incrementally.
const STAGE_MODIFIERS: Partial<Record<number, StageModifier>> = {
  0: {
    encounterMul: 1.0,
    restGainMul: 1.0,
    foeLevelBonus: 0,
    flavor: "The wet evergreens of the Cascades. The Cinder lights an easy road; the south will harden.",
  },
  1: {
    encounterMul: 1.0,
    restGainMul: 1.0,
    foeLevelBonus: 0,
    flavor: "The northern coast. The mirror is still a rumor here, but the wind smells of wet iron.",
  },
  2: {
    encounterMul: 1.0,
    restGainMul: 1.0,
    foeLevelBonus: 0,
    flavor: "The Central Valley. Ruins of the old world rise from yellow fields — every stone has a story.",
  },
  3: {
    encounterMul: 0.8,
    restGainMul: 0.8,
    foeLevelBonus: 0,
    flavor: "The dry heat of the Sonoran. Travel by night; rest is thin and slow.",
  },
  4: {
    encounterMul: 0.6,
    // PROVISIONAL: was 0.5; softened to 0.6 because the Hearth's deep-tend
    // (which restores the whole Circle, ignoring this multiplier) already
    // gives the player a strong survival tool here. 0.5 stacked on top of
    // partial coherence rest was over-punishing.
    restGainMul: 0.6,
    foeLevelBonus: 0,
    flavor: "The long winter of the Sierra Madre. The cold dampens what camp restores.",
  },
  5: {
    encounterMul: 1.3,
    restGainMul: 1.0,
    foeLevelBonus: 1,
    flavor: "Yucatan. The mirror pressure is real here — fires meet you often, and sharper.",
  },
  6: {
    encounterMul: 1.5,
    restGainMul: 1.0,
    foeLevelBonus: 1,
    flavor: "The Isthmus. A narrow neck of land between two waters. The tide is constant.",
  },
  7: {
    // PROVISIONAL: was 1.0; lowered to 0.8 to sell "old and hard" as quality
    // over quantity. Fewer fights, but with foeLevelBonus +2 each one is
    // alpha-tier. The Andes are a final test, not a marathon.
    encounterMul: 0.8,
    restGainMul: 1.0,
    foeLevelBonus: 2,
    flavor: "The Equatorial Andes. The air is thin and clear. The fires here are old, and hard.",
  },
};

export function modifierFor(stageIndex: number): StageModifier {
  return STAGE_MODIFIERS[stageIndex] ?? DEFAULT_MODIFIER;
}

export function stageEncounterMul(run: RunState): number {
  return modifierFor(run.stageIndex).encounterMul;
}

export function stageRestGainMul(run: RunState): number {
  return modifierFor(run.stageIndex).restGainMul;
}

export function stageFoeLevelBonus(run: RunState): number {
  return modifierFor(run.stageIndex).foeLevelBonus;
}

export function stageFlavor(run: RunState): string {
  return modifierFor(run.stageIndex).flavor;
}

// Index-keyed accessor for use outside an active RunState (preview, tests).
// Clamps to the valid stage range.
export function modifierAt(stageIndex: number): StageModifier {
  const i = Math.max(0, Math.min(STAGES.length - 1, stageIndex));
  return modifierFor(i);
}
