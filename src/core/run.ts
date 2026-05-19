// The run (DESIGN.md §4, §9). A run is one migration push along the bible's
// authored 8-stage spine (PNW -> equator); difficulty rises with latitude.
//
// Day cycle: travel -> (maybe) encounter -> camp. Encounters are resolved by
// the Tide Defense / Cinder Duel systems (phases 5/6) and report an outcome
// back here via applyEncounterOutcome — this module owns run state, the stage
// spine, camp tending, bonded-death recovery, run-end, and meta-persistence.
//
// Run-scoped (lost on run end): the circle, camp integrity, provisions.
// Persisted across runs (DESIGN.md §9): the species dex and the memorial of
// dead bonded Cinders.

import { Rng, seedFrom } from "../rng";
import { load, save } from "../persistence";
import {
  kindle,
  restPeriod,
  isAlive,
  rememberMoment,
  type Cinder,
} from "./cinder";
import type { ReadingConditions, SampleClass } from "./reading";

// Bible §7 migration spine, north (low difficulty) -> equator (high).
export const STAGES: string[] = [
  "Cascade Foothills",
  "Northern California Coast",
  "Central Valley Ruins",
  "Sonoran Crossing",
  "Sierra Madre Camps",
  "Yucatan Approach",
  "Central American Isthmus",
  "Equatorial Andes",
];

const PROGRESS_GOAL = 5; // travel ticks per stage (PROVISIONAL pacing)
const ENCOUNTER_BASE = 0.35; // base per-tick encounter chance, scaled by latitude

export type RunPhase = "travel" | "encounter" | "camp" | "ended";
export type RunOutcome = "running" | "arrived" | "tribe-wiped";

export interface DexEntry {
  species: string;
  trueClass: "native" | "mirror" | "inert";
  firstSeenStage: string;
}

export interface MemorialEntry {
  name: string;
  stage: string;
  bond: number;
}

export interface CaughtEntry {
  name: string; // the wild fire's name (seeds its identity/art/rarity)
  stage: string; // where it was caught
}

export interface RunMeta {
  dex: DexEntry[];
  memorial: MemorialEntry[];
  caught: CaughtEntry[]; // wild fires won in duels — kept across runs
  memories: string[]; // recovered flashback ids — the memorial gallery
}

// A captured fire's inheritance from its battle (DESIGN.md §7 — the wild's
// remaining body becomes yours). Run-scoped: level/skills/coherence drop into
// THIS run's Circle as a real loot drop. Cross-run carryover (meta.caught)
// stays minimal — only {name, stage} — so recruiting from the stable in a
// fresh run still kindles the fire at L1 (roguelite-pure: mid-run drops are
// powerful, the stable identity is light).
export interface CapturedSnapshot {
  name: string; // seeds the fire's identity (art, spectral, manner, baseAcuity)
  level: number; // inherited from the foe at the moment of catch
  skills: string[]; // non-anchor techniques inherited from the foe (≤2)
  coherenceFrac: number; // 0..1 — the wear of the catch, carried into the run
}

export interface EncounterOutcome {
  campDamage: number; // 0..1 lost from camp integrity
  capturedName?: string; // legacy — kindles a fresh L1 fire of this name
  captured?: CapturedSnapshot; // rich — inherits level/skills/state from the foe
  dex?: DexEntry[]; // species catalogued this encounter
  bondMoment?: string; // a moment the bonded fire remembers
}

export interface RunState {
  runName: string;
  _rng: Rng;
  stageIndex: number;
  progress: number;
  phase: RunPhase;
  outcome: RunOutcome;
  circle: Cinder[]; // circle[0] is always the bonded Cinder
  campIntegrity: number; // 0 dead .. 1 whole
  provisions: number; // 0 starving .. 1 stocked
  meta: RunMeta;
}

const META_KEY = "meta";

export function loadMeta(): RunMeta {
  const m = load<RunMeta>(META_KEY, { dex: [], memorial: [], caught: [], memories: [] });
  // Tolerate older saves that predate a field.
  if (!Array.isArray(m.dex)) m.dex = [];
  if (!Array.isArray(m.memorial)) m.memorial = [];
  if (!Array.isArray(m.caught)) m.caught = [];
  if (!Array.isArray(m.memories)) m.memories = [];
  return m;
}

// Record a wild fire caught (deduped by name) so it persists in the Dex.
export function recordCaught(run: RunState, name: string): void {
  if (run.meta.caught.some((c) => c.name === name)) return;
  run.meta.caught.push({ name, stage: currentStage(run) });
}

export function persistMeta(run: RunState): void {
  save(META_KEY, run.meta);
}

// Recover a flashback into the persisted memory gallery (the Memorial). Works
// WITHOUT a RunState — the Initiation runs before a run exists — by reading,
// updating, and saving the global meta directly. Deduped; safe to re-call.
// startRun's loadMeta picks these up, so a run carries them and persistMeta
// keeps them.
export function collectMemory(id: string): void {
  const m = loadMeta();
  if (m.memories.indexOf(id) >= 0) return;
  m.memories.push(id);
  save(META_KEY, m);
}

export function hasMemory(meta: RunMeta, id: string): boolean {
  return meta.memories.indexOf(id) >= 0;
}

// Recover a flashback DURING a run (e.g. a `?` ruin). Updates this run's meta
// in place AND persists immediately, so the memorial gallery reflects it now
// and it survives even if the run later ends badly. Returns false if already
// recovered. (collectMemory above is the run-less Initiation path.)
export function recoverMemoryInRun(run: RunState, id: string): boolean {
  if (run.meta.memories.indexOf(id) >= 0) return false;
  run.meta.memories.push(id);
  persistMeta(run);
  return true;
}

export function bondedCinder(run: RunState): Cinder {
  return run.circle[0];
}

// --- the caught-fire roster (recruit from camp) ----------------------------
// meta.caught persists across runs (a stable). At camp the player draws from
// it: recruiting kindles that fire into THIS run's circle; releasing drops a
// circle-fire (never the bonded one at index 0). Identity is name-deterministic
// (kindle), so a caught name fully reproduces the fire.

export function inCircle(run: RunState, name: string): boolean {
  return run.circle.some((c) => c.name === name);
}

export function recruitFromCaught(run: RunState, name: string): boolean {
  if (!run.meta.caught.some((c) => c.name === name)) return false; // not in the stable
  if (inCircle(run, name)) return false; // already fielded
  run.circle.push(kindle(name, false));
  return true;
}

export function releaseFromCircle(run: RunState, name: string): boolean {
  const i = run.circle.findIndex((c) => c.name === name);
  if (i <= 0) return false; // 0 is the bonded fire — never released
  run.circle.splice(i, 1);
  return true;
}

export function startRun(runName: string): RunState {
  const rng = new Rng(seedFrom("run:" + runName));
  const bonded = kindle("Brasa-" + runName, true);
  return {
    runName,
    _rng: rng,
    stageIndex: 0,
    progress: 0,
    phase: "travel",
    outcome: "running",
    circle: [bonded],
    campIntegrity: 1,
    provisions: 1,
    meta: loadMeta(),
  };
}

// A fresh seed string for a new run, so every playthrough's route and chapadas
// differ. (A run name still seeds everything deterministically — same name =>
// same run — which keeps runs shareable/repeatable when a name is given.)
export function randomRunName(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c !== undefined && typeof c.getRandomValues === "function") {
    const a = new Uint32Array(2);
    c.getRandomValues(a);
    return a[0].toString(36) + a[1].toString(36);
  }
  return Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
}

export function currentStage(run: RunState): string {
  return STAGES[run.stageIndex];
}

// 0 (far north) .. 1 (equator). Drives ambient noise and encounter pressure.
export function latitudeFactor(run: RunState): number {
  return run.stageIndex / (STAGES.length - 1);
}

// Default ambient Reading conditions for the current stage. Spore load rises
// southward (bible §5); callers may override wind/night per scene.
export function stageConditions(run: RunState, sample: SampleClass): ReadingConditions {
  const lat = latitudeFactor(run);
  return {
    sporeLoad: 0.1 + 0.8 * lat,
    wind: 0.25,
    night: true,
    sample,
  };
}

// Advance one travel tick. Returns true if an encounter triggers — the caller
// runs the encounter (phase 5/6) then calls applyEncounterOutcome. When the
// stage's travel is exhausted, the phase moves to camp.
export function advanceTravel(run: RunState): boolean {
  if (run.phase !== "travel") return false;
  run.progress += 1;
  const encChance = ENCOUNTER_BASE + 0.4 * latitudeFactor(run);
  if (run._rng.chance(encChance)) {
    run.phase = "encounter";
    return true;
  }
  if (run.progress >= PROGRESS_GOAL) run.phase = "camp";
  return false;
}

export function applyEncounterOutcome(run: RunState, out: EncounterOutcome): void {
  if (run.phase !== "encounter") return;
  run.campIntegrity = clamp01(run.campIntegrity - out.campDamage);
  if (out.captured !== undefined) {
    // Rich capture: the fire arrives with the wild's level, learned techniques,
    // and the wear of the catch (DESIGN.md §7 — capture as loot drop, not just
    // a completion check). kindle gives the identity (art / spectral / manner
    // from the name); we then overwrite the inherited stats. Vitality is NOT
    // inherited — it stays at the kindle default, so the catch doesn't punish
    // a thorough weakening that drained the foe's mana.
    const snap = out.captured;
    const cap = kindle(snap.name, false);
    cap.level = Math.max(1, Math.min(12, Math.round(snap.level)));
    cap.skills = [...snap.skills];
    cap.coherenceFrac = clamp01(snap.coherenceFrac);
    run.circle.push(cap);
    recordCaught(run, snap.name);
  } else if (out.capturedName !== undefined) {
    run.circle.push(kindle(out.capturedName, false));
    recordCaught(run, out.capturedName);
  }
  if (out.dex !== undefined) {
    for (let i = 0; i < out.dex.length; i++) {
      const e = out.dex[i];
      if (!run.meta.dex.some((d) => d.species === e.species)) run.meta.dex.push(e);
    }
  }
  if (out.bondMoment !== undefined) {
    rememberMoment(bondedCinder(run), out.bondMoment);
  }
  if (run.campIntegrity <= 0) {
    endRun(run, "tribe-wiped");
    return;
  }
  run.phase = run.progress >= PROGRESS_GOAL ? "camp" : "travel";
}

// Close the camp period: every fire that read this period built its streak;
// neglected fires decay (bible §8). A bonded fire that dies here does NOT end
// the run — the tribe gives a fresh Hearth ember; the dead one is memorialised
// (DESIGN.md §13 item 5, bible §9).
// Tend every fire for one period (no stage advance). Neglected fires decay; a
// dead circle-fire is dropped; a dead bonded fire is memorialised and re-embered
// — the run continues (DESIGN.md §13 item 5, bible §9). Used by both the linear
// tendCamp and the route-map camp nodes.
export function tendFires(run: RunState): void {
  for (let i = run.circle.length - 1; i >= 0; i--) {
    const fire = run.circle[i];
    restPeriod(fire); // camp = recovery: living fires regain vitality
    if (!isAlive(fire)) {
      if (fire.bonded) {
        run.meta.memorial.push({ name: fire.name, stage: currentStage(run), bond: fire.bond });
        run.circle[i] = kindle("Brasa-" + run.runName + "-" + run.meta.memorial.length, true);
      } else {
        run.circle.splice(i, 1);
      }
    }
  }
}

// Snuff a specific fire (a staked Cinder Duel lost, bible §9 / DESIGN.md §7).
// A bonded fire is memorialised and re-embered (the run continues); a circle-
// fire simply gutters out. Returns true if the fire was the bonded one.
export function extinguishFire(run: RunState, fire: Cinder): boolean {
  const i = run.circle.indexOf(fire);
  if (i < 0) return false;
  fire.vitality = 0;
  if (fire.bonded) {
    run.meta.memorial.push({ name: fire.name, stage: currentStage(run), bond: fire.bond });
    run.circle[i] = kindle("Brasa-" + run.runName + "-" + run.meta.memorial.length, true);
    return true;
  }
  run.circle.splice(i, 1);
  return false;
}

export function tendCamp(run: RunState): void {
  if (run.phase !== "camp") return;
  tendFires(run);
  run.progress = 0;
  run.stageIndex += 1;
  if (run.stageIndex >= STAGES.length) {
    endRun(run, "arrived");
    return;
  }
  run.phase = "travel";
}

// Phase-agnostic spoils/cost for non-tide route nodes (forage, ruin, …).
// Tribe-wipe on a depleted camp ends the run.
export interface NodeSpoils {
  campDamage?: number;
  provisions?: number; // signed delta
  capturedName?: string;
  dex?: DexEntry[];
  bondMoment?: string;
}

export function applySpoils(run: RunState, s: NodeSpoils): void {
  if (s.campDamage !== undefined) run.campIntegrity = clamp01(run.campIntegrity - s.campDamage);
  if (s.provisions !== undefined) run.provisions = clamp01(run.provisions + s.provisions);
  if (s.capturedName !== undefined) {
    run.circle.push(kindle(s.capturedName, false));
    recordCaught(run, s.capturedName);
  }
  if (s.dex !== undefined) {
    for (let i = 0; i < s.dex.length; i++) {
      const e = s.dex[i];
      if (!run.meta.dex.some((d) => d.species === e.species)) run.meta.dex.push(e);
    }
  }
  if (s.bondMoment !== undefined) rememberMoment(bondedCinder(run), s.bondMoment);
  if (run.campIntegrity <= 0) endRun(run, "tribe-wiped");
}

// Set the stage (latitude) directly — the route map's rank drives this.
export function setStage(run: RunState, stageIndex: number): void {
  run.stageIndex = Math.max(0, Math.min(STAGES.length - 1, stageIndex));
}

// Reaching the equator node ends the run as a win.
export function arriveAtEquator(run: RunState): void {
  endRun(run, "arrived");
}

export function isRunOver(run: RunState): boolean {
  return run.phase === "ended";
}

function endRun(run: RunState, outcome: RunOutcome): void {
  run.outcome = outcome;
  run.phase = "ended";
  persistMeta(run); // dex + memorial survive the run
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
