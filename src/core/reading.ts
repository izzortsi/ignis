// The Reading engine (DESIGN.md §5) — the one noisy classifier both battle
// modes call. A sample has a hidden truth; a fire returns a *felt band*, never
// a number. The probabilistic shape is real; it is never shown to the player.
//
// Model: truth sits on a latent handedness axis (-1 native pole, +1 mirror
// pole). A fire observes it with Gaussian noise whose width is set by how
// *sharp* the fire+conditions are (vitality, spectral fit, ambient). The
// observation is sliced into bands by fixed thresholds, then nudged by the
// fire's manner (presentation bias, not accuracy). Joint Readings average
// independent observations — variance drops like 1/n, a real ensemble effect.

import type { Rng } from "../rng";

export type Truth = "native" | "mirror" | "inert";

// Felt bands, English per DESIGN.md §14. Ordered native -> mirror; "handless"
// is the off-axis inert verdict.
export type Band =
  | "of-our-hand" // strong native — safe
  | "seems-of-our-hand" // weak native — likely safe
  | "fire-hesitates" // ambiguous — hold / retest
  | "seems-touched" // weak mirror — discard
  | "touched" // strong mirror — burn, don't handle
  | "handless"; // inert — no chirality to read

export type FireManner = "confident" | "cautious" | "histrionic";

// A fire reads some sample classes better than others (spectral fit).
export type SpectralType = "amber" | "azure" | "ashen";
export type SampleClass = "water" | "grain" | "flesh" | "blood" | "stone" | "gear";

export interface FireReadProfile {
  vitality: number; // 0 dying .. 1 burn-bright
  spectral: SpectralType;
  manner: FireManner;
  baseAcuity: number; // innate keenness, 0..1 (PROVISIONAL per-fire trait)
}

export interface ReadingConditions {
  sporeLoad: number; // 0 clean .. 1 monoculture (rises southward) — blurs
  wind: number; // 0 still .. 1 gale — blurs
  night: boolean; // night is sharper (less ambient unpolarized light)
  sample: SampleClass;
}

export interface ReadingResult {
  band: Band;
  // Internal — for tests/tuning and joint combination only. Never rendered.
  _latent: number;
  _sharpness: number;
}

// --- tuning constants (feel-tuned, never surfaced) -------------------------

const SIGMA_SHARP = 0.14; // observation noise when maximally sharp
const SIGMA_BLUR = 0.8; // observation noise when maximally blurred
const THRESH = { strongN: -0.6, weakN: -0.22, weakM: 0.22, strongM: 0.6 };

// How well each spectral type reads each sample class (0.6 poor .. 1 ideal).
const SPECTRAL_FIT: Record<SpectralType, Record<SampleClass, number>> = {
  amber: { water: 0.95, grain: 0.9, flesh: 0.8, blood: 0.7, stone: 1.0, gear: 0.85 },
  azure: { water: 1.0, grain: 0.8, flesh: 0.7, blood: 0.6, stone: 0.9, gear: 0.95 },
  ashen: { water: 0.8, grain: 0.85, flesh: 0.95, blood: 0.9, stone: 0.85, gear: 0.7 },
};

// How well a spectral type reads a sample class (0.6 poor .. 1 ideal).
// Exposed for the encounter stats sheet.
export function spectralFit(spectral: SpectralType, sample: SampleClass): number {
  return SPECTRAL_FIT[spectral][sample];
}

// --- engine ---------------------------------------------------------------

// Sharpness in [0,1]: how tightly this fire, here, now, can resolve handedness.
export function sharpness(fire: FireReadProfile, cond: ReadingConditions): number {
  const fit = SPECTRAL_FIT[fire.spectral][cond.sample];
  const ambient = clamp01(1 - 0.55 * cond.sporeLoad - 0.3 * cond.wind) * (cond.night ? 1.0 : 0.78);
  const s = clamp01(fire.vitality) * clamp01(fire.baseAcuity) * fit * ambient;
  return clamp01(s);
}

// Signal amplitude as a function of coherence. A starved fire doesn't merely
// get noisier — its polarimetric SNR collapses, so the handedness pole itself
// fades toward zero ("a starved Cinder begins to lie", bible §12). Full signal
// returns by mid sharpness; near-dead fires barely separate the poles.
function signalGain(s: number): number {
  return 0.35 + 0.65 * clamp01(s / 0.5);
}

// One independent latent observation of the truth by this fire.
function observe(truth: Truth, s: number, rng: Rng): number {
  const sigma = lerp(SIGMA_BLUR, SIGMA_SHARP, s);
  const noise = gaussian(rng) * sigma;
  const pole = signalGain(s);
  if (truth === "native") return -pole + noise;
  if (truth === "mirror") return pole + noise;
  // inert: no chirality. Reads near zero, but a sharp fire recognizes "nothing
  // to read" (handless); a blurred one mistakes the void for hesitation.
  return noise * 0.5;
}

function bandFromLatent(latent: number, truth: Truth, s: number, rng: Rng): Band {
  if (truth === "inert") {
    // The cleaner the read, the more confidently it reports "handless".
    const pHandless = 0.45 + 0.5 * s;
    if (rng.chance(pHandless)) return "handless";
    if (Math.abs(latent) < 0.45) return "fire-hesitates";
    return latent < 0 ? "seems-of-our-hand" : "seems-touched"; // rare spurious
  }
  if (latent < THRESH.strongN) return "of-our-hand";
  if (latent < THRESH.weakN) return "seems-of-our-hand";
  if (latent < THRESH.weakM) return "fire-hesitates";
  if (latent < THRESH.strongM) return "seems-touched";
  return "touched";
}

// Manner reshapes presentation, not accuracy: a confident fire collapses holds
// into a (possibly wrong) call; a cautious fire retreats to "hesitates"; a
// histrionic fire overstates weak into strong.
function applyManner(band: Band, manner: FireManner, latent: number, rng: Rng): Band {
  if (band === "handless") return band;
  if (manner === "confident" && band === "fire-hesitates") {
    return latent < 0 ? "seems-of-our-hand" : "seems-touched";
  }
  if (manner === "cautious" && (band === "seems-of-our-hand" || band === "seems-touched")) {
    if (rng.chance(0.5)) return "fire-hesitates";
  }
  if (manner === "histrionic") {
    if (band === "seems-of-our-hand" && rng.chance(0.6)) return "of-our-hand";
    if (band === "seems-touched" && rng.chance(0.6)) return "touched";
  }
  return band;
}

export function performReading(
  truth: Truth,
  fire: FireReadProfile,
  cond: ReadingConditions,
  rng: Rng,
): ReadingResult {
  const s = sharpness(fire, cond);
  const latent = observe(truth, s, rng);
  const raw = bandFromLatent(latent, truth, s, rng);
  return { band: applyManner(raw, fire.manner, latent, rng), _latent: latent, _sharpness: s };
}

// Joint Reading (DESIGN.md §5; bible §16 Q12): present the same sample to
// several fires and combine. Independent observations averaged -> the noise
// shrinks like 1/sqrt(n). Caller pays the turn/vitality cost.
export function jointReading(
  truth: Truth,
  fires: FireReadProfile[],
  cond: ReadingConditions,
  rng: Rng,
): ReadingResult {
  if (fires.length === 0) throw new Error("jointReading needs at least one fire");
  let sum = 0;
  let sharpSum = 0;
  let manner: FireManner = fires[0].manner;
  for (let i = 0; i < fires.length; i++) {
    const s = sharpness(fires[i], cond);
    sum += observe(truth, s, rng);
    sharpSum += s;
    if (i === 0) manner = fires[i].manner;
  }
  const latent = sum / fires.length;
  const effSharp = clamp01((sharpSum / fires.length) * Math.min(1.6, Math.sqrt(fires.length)));
  const raw = bandFromLatent(latent, truth, effSharp, rng);
  return { band: applyManner(raw, manner, latent, rng), _latent: latent, _sharpness: effSharp };
}

// Band -> in-world meaning, for UI/dex gloss. The PLAYER still decides the
// action (eat/pass/burn/quarantine/retest); this is not auto-resolution.
export function bandMeaning(band: Band): string {
  switch (band) {
    case "of-our-hand": return "of our hand — safe";
    case "seems-of-our-hand": return "seems of our hand — likely safe";
    case "fire-hesitates": return "the fire hesitates — hold, or read again";
    case "seems-touched": return "seems touched — discard";
    case "touched": return "touched — burn it, do not handle";
    case "handless": return "handless — nothing to read";
  }
}

// --- helpers --------------------------------------------------------------

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Standard normal via Box-Muller, drawing two deterministic floats.
function gaussian(rng: Rng): number {
  let u1 = rng.nextFloat();
  const u2 = rng.nextFloat();
  if (u1 < 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
