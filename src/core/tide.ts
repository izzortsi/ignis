// Encounter — a single wild thing crosses your path (from the grass). No
// tide-wave: it is one creature. Read it with a fire (felt band, never a
// number), optionally retest (joint Reading, bible §16 Q12), then decide
// pass / burn / quarantine. Truth is revealed only by the consequence; the
// encounter reports one EncounterOutcome back to the run.
//
// (Type names keep the legacy "Tide" prefix to bound the rename; conceptually
// every TideEncounter is now a one-entity encounter.)

import { performReading, jointReading, type Band } from "./reading";
import { feedReading, expelNoise, readProfile, type Cinder } from "./cinder";
import {
  latitudeFactor,
  currentStage,
  stageConditions,
  bondedCinder,
  type RunState,
  type EncounterOutcome,
  type DexEntry,
} from "./run";
import type { Truth, SampleClass } from "./reading";
import { pickSpecies } from "./bestiary";

export type TideAction = "pass" | "burn" | "quarantine";

export interface TideEntity {
  species: string;
  sample: SampleClass;
  _truth: Truth;
  resolved: boolean;
}

export interface TideEncounter {
  entities: TideEntity[];
  index: number;
  reads: Band[]; // bands gathered for the *current* entity (for display)
  _fires: Cinder[]; // fires used on the current entity (for joint retest)
  campDamage: number; // accumulated; delivered via outcome
  dexHits: DexEntry[];
  overrun: boolean;
  finished: boolean;
}

// PROVISIONAL damage table (feel-tuned, never surfaced).
const DMG = {
  mirrorPassed: 0.26, // ate poison — the deadly error
  mirrorQuarantined: 0.0,
  nativeBurned: 0.12, // wasted food — a hungry winter (bible §9)
  nativeQuarantined: 0.04,
  inertBurned: 0.05,
  inertQuarantined: 0.02,
};

// A single wild thing crosses your path (a grass / Pokémon-style random
// encounter). Mirror grows likelier the deeper south you are.
export function makeEncounter(run: RunState): TideEncounter {
  const rng = run._rng;
  const lat = latitudeFactor(run);
  const roll = rng.nextFloat();
  const cls: Truth = roll < 0.45 + 0.3 * lat ? "mirror" : roll < 0.85 ? "native" : "inert";
  const sp = pickSpecies(rng, cls);
  return {
    entities: [{ species: sp.name, sample: sp.sample, _truth: sp.trueClass, resolved: false }],
    index: 0,
    reads: [],
    _fires: [],
    campDamage: 0,
    dexHits: [],
    overrun: false,
    finished: false,
  };
}

export function current(t: TideEncounter): TideEntity | undefined {
  return t.entities[t.index];
}

// Read the current entity with a fire. The first call is the lone Reading;
// each further call adds that fire and the verdict becomes a joint Reading of
// all fires used so far (variance drops ~1/sqrt(n)). Reading feeds the fire.
export function readCurrent(t: TideEncounter, run: RunState, fire: Cinder): Band {
  const ent = current(t);
  if (ent === undefined || t.finished) throw new Error("no entity to read");
  feedReading(fire);
  t._fires.push(fire);
  const cond = stageConditions(run, ent.sample);
  const result =
    t._fires.length === 1
      ? performReading(ent._truth, readProfile(fire), cond, run._rng)
      : jointReading(ent._truth, t._fires.map(readProfile), cond, run._rng);
  t.reads.push(result.band);
  return result.band;
}

// Resolve the current entity and advance. A damaging mistake makes the fire
// expel noise (bible §8). A correct handling catalogues the species.
export function decide(t: TideEncounter, run: RunState, action: TideAction): void {
  const ent = current(t);
  if (ent === undefined || t.finished) return;

  const fire = t._fires.length > 0 ? t._fires[t._fires.length - 1] : bondedCinder(run);
  let correct = false;
  let damage = 0;

  if (ent._truth === "mirror") {
    if (action === "pass") damage = DMG.mirrorPassed;
    else if (action === "quarantine") damage = DMG.mirrorQuarantined;
    else correct = true; // burned the mirror — right call
  } else if (ent._truth === "native") {
    if (action === "burn") damage = DMG.nativeBurned;
    else if (action === "quarantine") damage = DMG.nativeQuarantined;
    else correct = true; // passed safe food — right call
  } else {
    if (action === "burn") damage = DMG.inertBurned;
    else if (action === "quarantine") damage = DMG.inertQuarantined;
    else correct = true; // an inert thing, let it pass
  }

  if (damage > 0) expelNoise(fire);
  if (correct) {
    t.dexHits.push({
      species: ent.species,
      trueClass: ent._truth,
      firstSeenStage: currentStage(run),
    });
  }

  t.campDamage += damage;
  ent.resolved = true;
  t.index += 1;
  t.reads = [];
  t._fires = [];

  if (t.campDamage >= run.campIntegrity) {
    t.overrun = true;
    t.finished = true;
  } else if (t.index >= t.entities.length) {
    t.finished = true;
  }
}

export function tideOutcome(t: TideEncounter): EncounterOutcome {
  const out: EncounterOutcome = {
    campDamage: t.overrun ? 1 : t.campDamage,
  };
  if (t.dexHits.length > 0) out.dex = t.dexHits;
  return out;
}
