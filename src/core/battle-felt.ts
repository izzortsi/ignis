// The no-numbers firewall (plan §2). Pure functions number -> felt token. The
// battle UI imports ONLY these and contains zero thresholds, so a digit, %,
// level, or HP value can never leak to the player (DESIGN.md §1.1, §5; bible
// §10: "the fire never speaks in numbers"). No Solid, no DOM — unit-tested at
// every boundary.

import type { Condition, Technique, WheelType } from "./battle";

// The informational type, as a shown label (DESIGN.skills §2 — DECIDED: the
// type IS shown; it carries no number, so it does not break the §1.4 firewall).
export function typeWord(t: WheelType): string {
  switch (t) {
    case "entropy": return "entropy";
    case "negentropy": return "negentropy";
    case "signal": return "signal";
    case "noise": return "noise";
  }
}

// Coherence (the HP analogue): a fraction 0..1 -> a felt word + a discrete
// cell count for the segmented gauge. Six coarse buckets so the eye cannot
// reverse-engineer a number from the bar.
export interface CoherenceFelt {
  word: string;
  cells: number; // 0..6 lit
  grave: boolean; // render in danger colour
}
export function coherenceFelt(frac: number): CoherenceFelt {
  const f = clamp01(frac);
  if (f <= 0) return { word: "all but out", cells: 0, grave: true };
  if (f < 0.18) return { word: "guttering", cells: 1, grave: true };
  if (f < 0.38) return { word: "wavering", cells: 2, grave: true };
  if (f < 0.6) return { word: "holding", cells: 3, grave: false };
  if (f < 0.82) return { word: "steady", cells: 4, grave: false };
  if (f < 1) return { word: "bright", cells: 5, grave: false };
  return { word: "whole", cells: 6, grave: false };
}

// Type-effectiveness as the fire's reaction, never a multiplier. `eff` is the
// engine's spectralFit×chiralMul (≈0.48 poor … ≈1.25 ideal).
export function pressFelt(eff: number): string {
  if (eff >= 1.12) return "the press bites deep";
  if (eff >= 0.95) return "it bites true";
  if (eff >= 0.78) return "it lands, no more";
  if (eff >= 0.62) return "it barely grazes";
  return "the touch slides off";
}

export function scatterFelt(glancing: boolean): string {
  return glancing ? "the read wanders wide" : "the read scatters — nothing takes";
}

// Move card sub-line: reliability + cost, from the move's hidden numbers.
export interface MoveFelt {
  reliability: string;
  cost: string;
}
export function moveFelt(m: Technique): MoveFelt {
  const reliability =
    m.accuracyBias >= 0.08 ? "a sure read" : m.accuracyBias <= -0.04 ? "a wild reach" : "a steady read";
  const cost =
    m.costVitality <= 0 ? "the fire rests on it" : m.costVitality >= 0.06 ? "costs the fire dearly" : "a light call";
  return { reliability, cost };
}

export function orderFelt(kind: "you-first" | "foe-first" | "cross"): string {
  if (kind === "you-first") return "Your fire reads first.";
  if (kind === "foe-first") return "The other fire is quicker — it reads first.";
  return "You move as one — your reads cross.";
}

// Felt stat bars (DESIGN.md §1.4 — discrete bands, NEVER a number). Six cells;
// the word names the band. `frac` is a normalized 0..1 (see
// battle.statProfile) — coherence keeps its own coherenceFelt above.
export interface BarFelt {
  word: string;
  cells: number; // 1..6 lit
}
const STAT_WORDS: Record<"vitality" | "power" | "keenness" | "resilience" | "initiative", string[]> = {
  vitality: ["guttering", "thin", "low", "fed", "strong", "brimming"],
  power: ["soft", "glancing", "firm", "hard", "fierce", "brutal"],
  keenness: ["clouded", "dim", "clear", "sharp", "keen", "piercing"],
  resilience: ["brittle", "thin", "set", "firm", "tough", "unyielding"],
  initiative: ["sluggish", "slow", "even", "brisk", "quick", "first"],
};
export type StatKind = keyof typeof STAT_WORDS;
export function barFelt(frac: number, kind: StatKind): BarFelt {
  const i = Math.min(5, Math.floor(clamp01(frac) * 6)); // 0..5
  return { word: STAT_WORDS[kind][i], cells: i + 1 };
}

// Capture / kindling: a staged felt ladder, no catch %.
const KINDLE_LADDER = ["the ember resists…", "it wavers…", "it leans toward your circle…"];
export function kindleFelt(stage: number): string {
  return KINDLE_LADDER[clampInt(stage, 0, KINDLE_LADDER.length - 1)];
}
export function captureFelt(took: boolean, name: string): string {
  return took ? `it takes — ${name} is of your circle now` : "it slips back to the dark";
}

// Post-battle growth, felt — never an XP bar (DESIGN.md §9).
export function growthFelt(kind: "sharper" | "steadied" | "none", name: string): string {
  if (kind === "sharper") return `${name} reads sharper for this`;
  if (kind === "steadied") return `${name} steadied`;
  return "";
}

// Hearth teaching readiness/cost — felt only, never an XP number (§1.4).
export function teachFelt(affordable: boolean, ready: boolean): string {
  if (!ready) return "not ready for this yet";
  return affordable ? "ready — it can take this" : "it must temper longer before it can hold this";
}

// Essence absorbed from a beaten wild — felt only.
export function absorbFelt(name: string): string {
  return `${name} draws the wild's craft into itself — a new technique`;
}

// Diegetic words for in-battle states (plus the read-through canon states).
export function condWord(c: Condition | "guttering" | "starved" | "burn-bright"): string {
  switch (c) {
    case "rattled": return "rattled";
    case "dazzled": return "scattered";
    case "spore-fouled": return "spore-choked";
    case "stoked": return "stoked";
    case "banked": return "banked";
    case "entropy-vulnerable": return "laid bare";
    case "jammed": return "swimming";
    case "decohering": return "coming apart";
    case "annealed": return "set hard";
    case "signal-locked": return "pinned";
    case "guttering": return "guttering";
    case "starved": return "starved";
    case "burn-bright": return "burn-bright";
  }
}

// --- helpers ---------------------------------------------------------------

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function clampInt(x: number, lo: number, hi: number): number {
  return Math.round(x < lo ? lo : x > hi ? hi : x);
}
