// The turn-based creature-battle engine (DESIGN.md §7, plan §1). Headless,
// deterministic, numeric — the player NEVER sees these numbers (the UI routes
// everything through battle-felt.ts). It is built ON the Reading engine, not
// beside it: every offensive act is a Reading of a contested sample, scored by
// calibration. Stats are pure functions of existing Cinder fields. Capture is
// weaken-then-kindle. Permadeath stays the staked-loss beat (bible §9).
//
// Determinism: identity rng = seedFrom("battle:"+runName+":"+nodeId); each turn
// gets a fresh rng = seedFrom("battlex:"+runName+":"+nodeId+":"+turn). Within a
// turn, draws happen in a fixed documented order so replays are identical.

import { Rng, seedFrom } from "../rng";
import {
  performReading,
  jointReading,
  spectralFit,
  type Band,
  type Truth,
  type SampleClass,
} from "./reading";
import {
  kindle,
  readProfile,
  feedReading,
  expelNoise,
  gainXp,
  isAlive,
  isBurnBright,
  type Cinder,
} from "./cinder";
import { partsForName, type Rarity } from "./petart";
import {
  latitudeFactor,
  stageConditions,
  extinguishFire,
  type RunState,
  type EncounterOutcome,
  type CapturedSnapshot,
} from "./run";
import type { MapNode } from "./routemap";

// --- shared with the Reading calibration (lifted from duel.ts) --------------

const ORD: Record<Exclude<Band, "handless">, number> = {
  "of-our-hand": 0,
  "seems-of-our-hand": 1,
  "fire-hesitates": 2,
  "seems-touched": 3,
  "touched": 4,
};

// How wrong a verdict is, given the truth (0 = perfect … 4 = inverted).
export function miscalibration(truth: Truth, band: Band): number {
  if (truth === "inert") return band === "handless" ? 0 : 4;
  if (band === "handless") return 4;
  const ideal = truth === "native" ? 0 : 4;
  return Math.abs(ORD[band] - ideal);
}

// --- types -----------------------------------------------------------------

export type OpponentKind = "wild" | "peer" | "rival";
export type Stance = "native" | "mirror" | "neutral";
export type MoveKind = "press" | "joint" | "feint" | "bank" | "stoke" | "scatter" | "guard";
export type Condition =
  | "rattled" | "dazzled" | "spore-fouled" | "stoked" | "banked"
  // DESIGN.skills §5 — the informational-skill states.
  | "entropy-vulnerable" // Entropy moves hit it ×2.1
  | "jammed" // its reads swim — degraded calibration
  | "decohering" // coherence bleeds each turn (a DoT)
  | "annealed" // set hard — incoming damage strongly blunted
  | "signal-locked"; // pinned to its hand — takes more, cannot slip

// The informational type wheel (DESIGN.skills §2, move-only typing). 4-cycle:
// each type beats exactly one and is weak to the one that beats it.
export type WheelType = "entropy" | "negentropy" | "signal" | "noise";
const BEATS: Record<WheelType, WheelType> = {
  entropy: "negentropy",
  negentropy: "noise",
  noise: "signal",
  signal: "entropy",
};
// Strong ×1.2, weak ×0.83 (≈1/1.2), neutral ×1.0 (DESIGN.skills §2, DECIDED).
export function wheelMul(move: WheelType, against: WheelType): number {
  if (BEATS[move] === against) return 1.2;
  if (BEATS[against] === move) return 0.83;
  return 1.0;
}

export interface Technique {
  id: string;
  name: string;
  kind: MoveKind;
  stance: Stance;
  type: WheelType; // the informational type (shown in UI as a label)
  desc: string; // authored felt blurb — what it does (no numbers; shown in UI)
  power: number; // 0 = status/utility only
  accuracyBias: number; // shifts effective sharpness (−0.2..+0.2)
  costVitality: number; // signed; negative = recovers (bank)
  priority: number; // initiative bracket (−1..+2)
  status?: { cond: Condition; chance: number; target: "self" | "foe"; turns: number };
  // §4 effect levers (optional): pierce ignores a fraction of foe resilience;
  // siphon heals the attacker that fraction of damage dealt; compresses scales
  // damage with the foe's disorder; clears removes a cond from the status
  // target when the move resolves (guard/bank utility).
  pierce?: number;
  siphon?: number;
  compresses?: boolean;
  clears?: Condition;
  learn: { minLevel: number; minBond?: number; spectral?: ("amber" | "azure" | "ashen")[] };
}

export interface ActiveCond {
  cond: Condition;
  turns: number;
}

export interface Combatant {
  cinder: Cinder;
  loadout: Technique[];
  coherence: number;
  maxCoherence: number;
  conds: ActiveCond[];
  down: boolean; // fainted this battle (not dead — see finalizeBattle)
  lastType: WheelType | null; // type of its last move (the wheel reads this)
}

export interface BattleSetup {
  kind: OpponentKind;
  foeName: string;
  captureName: string; // the name a caught wild takes
  foe: Cinder;
  canCapture: boolean; // wild only
}

export type BattleResult = "win" | "lose" | "fled" | "captured" | "walked";

export interface TurnEvent {
  // The UI maps these to felt strings via battle-felt.ts. Numbers are internal.
  actor: "you" | "foe";
  text: string; // a stable key, not display copy
  band?: Band;
  effectiveness?: number; // 0..~1.5
  miss?: boolean;
  damage?: number;
  status?: Condition;
}

export interface BattleState {
  setup: BattleSetup;
  you: Combatant[]; // the Circle (you[0] is the bonded fire)
  foe: Combatant;
  activeYou: number;
  turn: number;
  log: TurnEvent[];
  done: boolean;
  result: BattleResult | null;
  _runName: string;
  _nodeId: number;
  _nonce: number; // per-encounter salt: a fresh foe each grass/site battle
  triedCatch: boolean; // one capture attempt per wild — spent once used
}

export type Action =
  | { type: "move"; moveId: string }
  | { type: "switch"; idx: number }
  | { type: "catch" }
  | { type: "flee" };

// --- the move pool ---------------------------------------------------------

export const MOVE_POOL: Technique[] = [
  // The two starter skills (DESIGN.skills §3 — the only typed-skill content
  // built in this pass; §4 backlog deferred). Both learn at L1.
  // The ONLY level-1 moves — a fresh fire starts with exactly these two
  // (DESIGN.skills §3/§5). Everything else is a level-up unlock (now earned
  // via battle XP, §9).
  // The two L1 starters — every fire's anchors (DESIGN.skills §3).
  { id: "negentropic-read", name: "Negentropic Read", kind: "feint", stance: "neutral", type: "negentropy", desc: "Reads the foe's order and lays it bare — entropy bites far harder after.", power: 0, accuracyBias: 0.05, costVitality: 0, priority: 1, status: { cond: "entropy-vulnerable", chance: 1, target: "foe", turns: 3 }, learn: { minLevel: 1 } },
  { id: "entropic-blast", name: "Entropic Blast", kind: "press", stance: "neutral", type: "entropy", desc: "A blast of pure disorder — one clean strike.", power: 1.05, accuracyBias: 0, costVitality: 0, priority: 0, learn: { minLevel: 1 } },
  // The designed informational skills (DESIGN.skills §4) — taught at the
  // ancient fire as the fire grows ready (PROVISIONAL learn curve).
  { id: "maxwells-cut", name: "Maxwell's Cut", kind: "press", stance: "neutral", type: "negentropy", desc: "A demon's sorting cut — slips past much of the foe's guard.", power: 0.95, accuracyBias: 0.08, costVitality: 0.10, priority: 0, pierce: 0.35, learn: { minLevel: 2 } },
  { id: "shannon-jam", name: "Shannon Jam", kind: "feint", stance: "neutral", type: "noise", desc: "Floods the foe with noise — its reads swim and scatter.", power: 0, accuracyBias: 0, costVitality: 0.12, priority: 1, status: { cond: "jammed", chance: 1, target: "foe", turns: 3 }, learn: { minLevel: 3 } },
  { id: "error-correct", name: "Error-Correct", kind: "bank", stance: "neutral", type: "negentropy", desc: "Error-corrects itself — restores coherence and clears one fouling. A heavy draw on the fire's breath.", power: 0, accuracyBias: 0, costVitality: 0.35, priority: 0, learn: { minLevel: 3 } },
  { id: "decoherence-cascade", name: "Decoherence Cascade", kind: "scatter", stance: "neutral", type: "entropy", desc: "Seeds disorder — the foe keeps coming apart for several turns.", power: 0.5, accuracyBias: 0, costVitality: 0.12, priority: -1, status: { cond: "decohering", chance: 0.9, target: "foe", turns: 3 }, learn: { minLevel: 4 } },
  { id: "anneal", name: "Anneal", kind: "guard", stance: "neutral", type: "signal", desc: "Sets hard — far tougher for a turn, and the decohering stops.", power: 0, accuracyBias: 0, costVitality: 0.22, priority: 2, status: { cond: "annealed", chance: 1, target: "self", turns: 2 }, clears: "decohering", learn: { minLevel: 5 } },
  { id: "negentropic-siphon", name: "Negentropic Siphon", kind: "press", stance: "neutral", type: "negentropy", desc: "Draws order out of the foe — damages it and mends itself.", power: 0.85, accuracyBias: 0, costVitality: 0.18, priority: 0, siphon: 0.5, learn: { minLevel: 5 } },
  { id: "compression-burst", name: "Compression Burst", kind: "press", stance: "neutral", type: "entropy", desc: "Feeds on the foe's disorder — the more frayed it is, the harder this bites.", power: 0.7, accuracyBias: 0, costVitality: 0.12, priority: 0, compresses: true, learn: { minLevel: 6 } },
  { id: "chirality-lock", name: "Chirality Lock", kind: "feint", stance: "neutral", type: "signal", desc: "Pins the foe to its hand — it cannot slip, and the next blows tell.", power: 0, accuracyBias: 0.05, costVitality: 0.14, priority: 1, status: { cond: "signal-locked", chance: 1, target: "foe", turns: 2 }, learn: { minLevel: 7 } },
  { id: "landauers-toll", name: "Landauer's Toll", kind: "press", stance: "neutral", type: "entropy", desc: "Erases the foe's order — a huge blow that costs the fire dearly.", power: 1.6, accuracyBias: -0.05, costVitality: 0.30, priority: 0, learn: { minLevel: 8 } },
  { id: "joint-read", name: "Joint Read", kind: "joint", stance: "neutral", type: "signal", desc: "Two fires read as one — a stronger, surer strike.", power: 1.15, accuracyBias: 0.1, costVitality: 0.16, priority: 0, learn: { minLevel: 8, minBond: 0.2 } },
];

export function learnableMoves(c: Cinder): Technique[] {
  return MOVE_POOL.filter((m) => {
    if (c.level < m.learn.minLevel) return false;
    if (m.learn.minBond !== undefined && (!c.bonded || c.bond < m.learn.minBond)) return false;
    if (m.learn.spectral !== undefined && !m.learn.spectral.includes(c.spectral)) return false;
    return true;
  });
}

// The two starter skills every fire implicitly knows (DESIGN.skills §3).
const ANCHOR_IDS = ["negentropic-read", "entropic-blast"];
function isAnchor(m: Technique): boolean {
  return ANCHOR_IDS.includes(m.id);
}

// NPC/foe kit: level-derived (they can't visit the ancient fire). The two
// starters anchor it; higher levels add a seeded spread up to 4.
export function defaultLoadout(c: Cinder): Technique[] {
  const pool = learnableMoves(c);
  const out: Technique[] = pool.filter(isAnchor);
  const rest = pool.filter((m) => !isAnchor(m));
  const rng = new Rng(seedFrom("loadout:" + c.name));
  while (out.length < 4 && rest.length > 0) {
    out.push(rest.splice(rng.nextInt(rest.length), 1)[0]);
  }
  return out;
}

// What the ancient fire could teach this fire NOW: eligible by readiness
// (level/bond/spectral) but not an anchor and not already taught.
export function teachableMoves(c: Cinder): Technique[] {
  return learnableMoves(c).filter((m) => !isAnchor(m) && !c.skills.includes(m.id));
}

// XP a skill costs to learn at the Hearth (DESIGN.skills §9 — XP is the
// progression currency). Mirrors xpToNext tiers so a skill is ~one level's
// worth of banked battle XP at its depth. PROVISIONAL.
export function teachCost(m: Technique): number {
  return 4 + 3 * (m.learn.minLevel - 1);
}

// Can the fire learn this NOW: ready (level/bond/spectral, not anchor, not
// known) AND has banked enough XP to pay. UI-facing.
export function canTeach(c: Cinder, m: Technique): boolean {
  return teachableMoves(c).some((t) => t.id === m.id) && c.xp >= teachCost(m);
}

// Teach one skill (the Hearth). Spends banked XP; refuses if not ready or not
// enough XP. Level is NEVER dropped — only post-rollover progress is spent.
export function teachSkill(c: Cinder, id: string): boolean {
  const m = teachableMoves(c).find((t) => t.id === id);
  if (!m) return false;
  const cost = teachCost(m);
  if (c.xp < cost) return false;
  c.xp = Math.max(0, c.xp - cost);
  c.skills.push(id);
  return true;
}

// A player fire's battle kit: the two starters it always knows, plus whatever
// the ancient fire has taught it (in teaching order), capped at 4. Pure — no
// level auto-grant, no rng (DESIGN.skills §3: skills are taught, not levelled).
export function knownLoadout(c: Cinder): Technique[] {
  const anchors = MOVE_POOL.filter(isAnchor);
  const taught: Technique[] = [];
  for (const id of c.skills) {
    const m = MOVE_POOL.find((t) => t.id === id);
    if (m && !isAnchor(m)) taught.push(m);
  }
  return [...anchors, ...taught].slice(0, 4);
}

// --- stats (pure; never displayed) -----------------------------------------

const RARITY_MUL: Record<Rarity, number> = { common: 1.0, uncommon: 1.08, rare: 1.18, legendary: 1.32 };

// Level-driven (DESIGN.skills — vitality is now purely the mana budget, it no
// longer scales the HP pool; bond still grows the bonded fire). PROVISIONAL.
export function maxCoherence(c: Cinder): number {
  const base = 44 + 8 * (c.level - 1);
  const bondMul = c.bonded ? 1 + 0.15 * c.bond : 1;
  return Math.round(base * bondMul);
}

export function power(c: Cinder): number {
  const rarity = RARITY_MUL[partsForName(c.name).rarity];
  return (0.5 + 0.5 * c.baseAcuity) * (1 + 0.06 * (c.level - 1)) * rarity;
}

export function keenness(c: Cinder): number {
  return readProfile(c).baseAcuity;
}

function critChance(c: Cinder): number {
  return clamp(0.04 + 0.2 * ((keenness(c) - 0.55) / 0.4), 0.02, 0.3);
}

// Level + acuity driven (vitality decoupled — it is the mana pool now). 12 =
// LEVEL_MAX (inlined to avoid widening cinder's export surface). PROVISIONAL.
export function resilience(c: Cinder): number {
  const lvl = (c.level - 1) / (12 - 1);
  return clamp(0.45 + 0.35 * lvl + 0.2 * c.baseAcuity + (isBurnBright(c) ? 0.1 : 0), 0.4, 1.1);
}

const SPECTRAL_SPEED = { azure: 0.6, amber: 0.45, ashen: 0.35 } as const;
const MANNER_SPEED = { confident: 0.15, histrionic: 0.1, cautious: 0.0 } as const;

export function initiative(c: Cinder, jitter: number): number {
  return (
    SPECTRAL_SPEED[c.spectral] +
    MANNER_SPEED[c.manner] +
    0.04 * (c.level - 1) +
    (isBurnBright(c) ? 0.15 : 0) +
    jitter
  );
}

// The five live battle stats as normalized 0..1 fractions — the ONLY thing
// the UI needs to draw felt stat bars (it never sees the raw values; the
// quantizing to felt bands lives in battle-felt). Ranges are PROVISIONAL
// (chosen to spread the realistic spans across the bar). Pure/deterministic.
export interface StatProfile {
  coherence: number; // current / max (live)
  vitality: number; // the fuel (live; drains on move cost)
  power: number; // the bite
  keenness: number; // the eye (crit / capture pull)
  resilience: number; // the hold (scales with level/acuity)
  initiative: number; // the speed (turn order)
}
export function statProfile(c: Cinder, coherenceFrac: number): StatProfile {
  return {
    coherence: clamp01(coherenceFrac),
    vitality: clamp01(c.vitality),
    power: clamp01((power(c) - 0.75) / (2.15 - 0.75)),
    keenness: clamp01((keenness(c) - 0.55) / (0.95 - 0.55)),
    resilience: clamp01((resilience(c) - 0.4) / (1.1 - 0.4)),
    initiative: clamp01((initiative(c, 0) - 0.35) / (1.35 - 0.35)),
  };
}

// Chirality resonance: a move's stance against the contested sample's truth.
function chiralMul(stance: Stance, truth: Truth): number {
  if (truth === "inert") return 0.9;
  if (stance === "neutral") return 1.0;
  const matches = (stance === "native" && truth === "native") || (stance === "mirror" && truth === "mirror");
  return matches ? 1.2 : 0.85;
}

// --- setup -----------------------------------------------------------------

const FOE_NAMES = ["Vexa", "Orrin", "the Ridge-fire", "Saud", "the Stranger", "Pell", "Calla", "the Far Ember"];
// Where a battle is sprung decides WHO you face:
//  - "grass" / "rubble": an ENCOUNTER — ALWAYS a wild cinder (catchable). The
//    two differ only in bestiary (soft fauna-fires vs ruin-things) + tilt.
//    (Animals are a planned third encounter foe — TBD, not yet.)
//  - "duel": a MARKED site — another PERSON and their Cinder. Never wild,
//    never catchable; peer (even) or rival (harder).
export type BattleSource = "grass" | "rubble" | "duel";
const WILD_NAMES: Record<"grass" | "rubble", string[]> = {
  grass: ["Wisp", "Mote", "Glint", "Char", "Spit", "Flwe", "Sere", "Tindra"],
  rubble: ["Slag", "Cinder-rat", "Grit", "Husk", "Shard", "Clinker", "Dross", "Scoria"],
};
const SAMPLES: SampleClass[] = ["water", "grain", "flesh", "blood", "stone", "gear"];

export function makeBattle(run: RunState, node: MapNode, nonce = 0, source: BattleSource = "grass"): BattleSetup {
  const rng = new Rng(seedFrom("battle:" + run.runName + ":" + node.id + ":" + source + ":" + nonce));
  const lat = latitudeFactor(run);
  const r = rng.nextFloat();
  // Encounters (grass/rubble) are ALWAYS a wild cinder; a duel is ALWAYS a
  // person + Cinder (peer or rival) — never wild, never catchable.
  const kind: OpponentKind = source === "duel" ? (r < 0.5 ? "peer" : "rival") : "wild";
  const isWild = kind === "wild";
  let foeName: string;
  let captureName: string;
  if (isWild) {
    const wildPool = source === "rubble" ? WILD_NAMES.rubble : WILD_NAMES.grass;
    foeName = wildPool[rng.nextInt(wildPool.length)];
    captureName = wildPool[rng.nextInt(wildPool.length)];
  } else {
    foeName = FOE_NAMES[rng.nextInt(FOE_NAMES.length)];
    captureName = ""; // a person's fire is never kindled
  }
  // Name includes the nonce so a re-encountered name is still a distinct fire.
  const foe = kindle(foeName + "-foe-" + node.id + "-" + nonce, false);
  // Scale the foe by latitude; wilds run a touch weak (catchable), rivals hot.
  const tilt = isWild ? -1 : kind === "rival" ? 2 : 0;
  foe.level = clampInt(2 + Math.round(lat * 8) + tilt, 1, 12);
  foe.vitality = clamp(0.7 + (kind === "rival" ? 0.15 : isWild ? -0.1 : 0) + lat * 0.1, 0.25, 1);
  return {
    kind,
    foeName,
    captureName,
    foe,
    canCapture: isWild,
  };
}

function combatant(c: Cinder, player: boolean): Combatant {
  const mc = maxCoherence(c);
  // Player fires carry their run-wide wear (DESIGN.md §8); foes are fresh
  // per-encounter NPCs. A player fire arriving at 0 is benched (down).
  const cur = player ? Math.round(mc * clamp01(c.coherenceFrac)) : mc;
  return {
    cinder: c,
    loadout: player ? knownLoadout(c) : defaultLoadout(c),
    coherence: cur,
    maxCoherence: mc,
    conds: [],
    down: player && cur <= 0,
    lastType: null,
  };
}

export function startBattle(run: RunState, node: MapNode, nonce = 0, source: BattleSource = "grass"): BattleState {
  const setup = makeBattle(run, node, nonce, source);
  const you = run.circle.filter(isAlive).map((c) => combatant(c, true));
  // Field the first fire that isn't benched (carried 0 coherence); if all are
  // benched, 0 stands and the round resolves out (the player can still flee).
  const firstUp = you.findIndex((cm) => !cm.down);
  return {
    setup,
    you,
    foe: combatant(setup.foe, false),
    activeYou: firstUp >= 0 ? firstUp : 0,
    turn: 0,
    log: [],
    done: false,
    result: null,
    _runName: run.runName,
    _nodeId: node.id,
    _nonce: nonce,
    triedCatch: false,
  };
}

// --- per-turn resolution ---------------------------------------------------

function turnRng(s: BattleState): Rng {
  return new Rng(seedFrom("battlex:" + s._runName + ":" + s._nodeId + ":" + s._nonce + ":" + s.turn));
}

// Foulings a fire can clear off ITSELF (Error-Correct). entropy-vulnerable is
// foe-applied and banked/stoked/annealed are boons, so none of those.
const SELF_DEBUFFS: Condition[] = ["rattled", "dazzled", "spore-fouled", "jammed", "decohering", "signal-locked"];

// Vitality IS the in-battle budget (the "mana" model — DESIGN.skills): skills
// cost breath, the two starters are free, and it trickles back slowly so
// recovery/utility can't be chained. A move may NEVER drain a fire to death —
// only a staked loss / camp neglect reaches 0 (see isAlive).
const DEATH_FLOOR = 0.04;
const BATTLE_REGEN = 0.01; // a faint breath back each round (PROVISIONAL — slow on purpose)
// Beating a wild: capture keeps it whole (less essence → less xp); winning
// absorbs it (full xp + a chance to take one of its techniques). PROVISIONAL.
const CAPTURE_XP_MUL = 0.5;
const ABSORB_CHANCE = 0.25;

export function canAfford(c: Combatant, m: Technique): boolean {
  return m.costVitality <= 0 || c.cinder.vitality >= m.costVitality + DEATH_FLOOR;
}
// What actually resolves when the wanted move can't be paid for: the cheapest
// affordable move (the free starters are always in every loadout).
function affordableMove(c: Combatant, want: Technique): Technique {
  if (canAfford(c, want)) return want;
  const free = c.loadout.filter((m) => canAfford(c, m));
  return free.find((m) => m.id === "entropic-blast") ?? free[0] ?? want;
}
function spendVitality(c: Combatant, cost: number): void {
  const lo = cost > 0 ? DEATH_FLOOR : 0; // a normal move never self-snuffs
  c.cinder.vitality = clamp(c.cinder.vitality - cost, lo, 1);
}

function hasCond(c: Combatant, k: Condition): boolean {
  return c.conds.some((a) => a.cond === k);
}

function addCond(c: Combatant, k: Condition, turns: number): void {
  const ex = c.conds.find((a) => a.cond === k);
  if (ex) ex.turns = Math.max(ex.turns, turns);
  else c.conds.push({ cond: k, turns });
}

function tickConds(c: Combatant): void {
  c.conds = c.conds.filter((a) => --a.turns > 0);
}

// One offensive/utility resolution. Mutates state; pushes a TurnEvent.
function resolveMove(
  s: BattleState,
  run: RunState,
  rng: Rng,
  attacker: Combatant,
  defender: Combatant,
  move: Technique,
  who: "you" | "foe",
): void {
  const ac = attacker.cinder;
  attacker.lastType = move.type; // the wheel reads the foe's last move type

  if (move.kind === "bank") {
    // Error-Correct: recover coherence + clear one self-fouling, but it does
    // NOT feed (no feedReading) and spends a heavy chunk of breath — so it
    // can't be chained (it drains the very budget it needs).
    attacker.coherence = Math.min(attacker.maxCoherence, attacker.coherence + Math.round(attacker.maxCoherence * 0.18));
    const i = attacker.conds.findIndex((a) => SELF_DEBUFFS.includes(a.cond));
    if (i >= 0) attacker.conds.splice(i, 1);
    spendVitality(attacker, move.costVitality);
    s.log.push({ actor: who, text: "bank" });
    return;
  }
  if (move.kind === "guard" || move.kind === "stoke") {
    if (move.status) addCond(move.status.target === "self" ? attacker : defender, move.status.cond, move.status.turns);
    // Anneal & kin clear a cond off the status target (e.g. decohering off self).
    if (move.clears) {
      const t = move.status && move.status.target === "foe" ? defender : attacker;
      t.conds = t.conds.filter((a) => a.cond !== move.clears);
    }
    spendVitality(attacker, move.costVitality);
    s.log.push({ actor: who, text: move.kind, status: move.status?.cond });
    return;
  }

  // A press/feint/joint/scatter is a Reading of a contested sample.
  const truth: Truth = (() => {
    const t = rng.nextFloat();
    const lat = latitudeFactor(run);
    return t < 0.45 + 0.3 * lat ? "mirror" : t < 0.85 ? "native" : "inert";
  })();
  const sample = SAMPLES[rng.nextInt(SAMPLES.length)];
  const cond = stageConditions(run, sample);
  if (hasCond(attacker, "spore-fouled")) cond.sporeLoad = clamp(cond.sporeLoad + 0.3, 0, 1);

  feedReading(ac); // every Reading is food (DESIGN §3)
  const reading =
    move.kind === "joint" && benchAllies(s).length > 0
      ? jointReading(truth, [readProfile(ac), readProfile(benchAllies(s)[0].cinder)], cond, rng)
      : performReading(truth, readProfile(ac), cond, rng);

  let mis = miscalibration(truth, reading.band);
  if (hasCond(attacker, "dazzled")) mis = Math.min(4, mis + 1);
  if (hasCond(attacker, "jammed")) mis = Math.min(4, mis + 1); // Shannon Jam
  if (hasCond(attacker, "stoked")) mis = Math.max(0, mis - 1);

  const hitThreshold = move.kind === "feint" ? 4 : 2; // feint always "lands" as a presence attack
  const miss = mis > hitThreshold;

  if (miss) {
    expelNoise(ac); // a scattered read costs the fire
    s.log.push({ actor: who, text: "scatter", band: reading.band, miss: true });
  } else {
    const quality = 1 - mis / 4; // 0..1, how clean the read
    const eff = spectralFit(ac.spectral, sample) * chiralMul(move.stance, truth);
    const rattleMul = hasCond(attacker, "rattled") ? 0.85 : 1;
    const bankedMul = hasCond(defender, "banked") ? 1 / 1.3 : 1;
    const annealMul = hasCond(defender, "annealed") ? 1 / 1.5 : 1; // Anneal
    const lockMul = hasCond(defender, "signal-locked") ? 1.15 : 1; // Chirality Lock
    // The informational type wheel (DESIGN.skills §2): the move type against
    // the defender's last move type, plus the entropy-vulnerable condition.
    const wheelM = defender.lastType !== null ? wheelMul(move.type, defender.lastType) : 1;
    const vulnM = move.type === "entropy" && hasCond(defender, "entropy-vulnerable") ? 2.1 : 1;
    let dmg = move.power * power(ac) * eff * (0.4 + 0.6 * quality) * rattleMul * bankedMul * annealMul * lockMul * wheelM * vulnM;
    // Maxwell's Cut & kin: ignore a fraction of the foe's resilience.
    const res = move.pierce ? Math.max(0.4, resilience(defender.cinder) * (1 - move.pierce)) : resilience(defender.cinder);
    dmg = dmg / res;
    // Compression Burst: the more frayed the foe, the harder it bites.
    if (move.compresses) {
      const disorder = 1 - defender.coherence / Math.max(1, defender.maxCoherence);
      dmg *= 1 + 0.9 * disorder + 0.08 * defender.conds.length;
    }
    const crit = reading._sharpness > 0.45 && rng.chance(critChance(ac));
    if (crit) dmg *= 1.5;
    dmg = Math.max(1, Math.round(dmg));
    defender.coherence = Math.max(0, defender.coherence - dmg);
    // Negentropic Siphon: mend the attacker by a fraction of damage dealt.
    if (move.siphon) {
      attacker.coherence = Math.min(
        attacker.maxCoherence,
        attacker.coherence + Math.max(1, Math.round(dmg * move.siphon)),
      );
    }
    s.log.push({ actor: who, text: move.kind, band: reading.band, effectiveness: eff, damage: dmg });

    if (move.status && rng.chance(move.status.chance)) {
      addCond(move.status.target === "self" ? attacker : defender, move.status.cond, move.status.turns);
    }
    // a hard, deep bite rattles the defender
    if (dmg >= defender.maxCoherence * 0.25) addCond(defender, "rattled", 2);
  }
  spendVitality(attacker, move.costVitality);
}

function benchAllies(s: BattleState): Combatant[] {
  return s.you.filter((c, i) => i !== s.activeYou && !c.down && isAlive(c.cinder));
}

function aliveYou(s: BattleState): Combatant[] {
  return s.you.filter((c) => !c.down && isAlive(c.cinder));
}

function foeChooseMove(s: BattleState, rng: Rng): Technique {
  // Greedy-ish, but only from moves it can afford (the free starters always
  // qualify, so `pool` is never empty).
  const f = s.foe;
  const usable = f.loadout.filter((m) => canAfford(f, m));
  const pool = usable.length > 0 ? usable : f.loadout;
  if (f.coherence < f.maxCoherence * 0.2) {
    const bank = pool.find((m) => m.kind === "bank");
    if (bank && rng.chance(0.6)) return bank;
  }
  const offense = pool.filter((m) => m.power > 0);
  return (offense.length > 0 ? offense : pool)[rng.nextInt(offense.length > 0 ? offense.length : pool.length)];
}

function endIf(s: BattleState): void {
  if (s.foe.coherence <= 0) {
    s.done = true;
    s.result = "win";
  } else if (aliveYou(s).length === 0) {
    s.done = true;
    s.result = "lose";
  }
}

// Drive one full round from the player's chosen action.
export function step(s: BattleState, run: RunState, action: Action): void {
  if (s.done) return;
  const rng = turnRng(s);
  const me = s.you[s.activeYou];

  if (action.type === "flee") {
    const p = clamp(0.35 + 0.4 * (initiative(me.cinder, 0) - initiative(s.foe.cinder, 0)), 0.1, 0.9);
    if (rng.chance(p)) {
      s.done = true;
      s.result = "fled";
      return;
    }
    s.log.push({ actor: "you", text: "flee-fail" });
    // failed flee — the foe still gets to act below
  }

  if (action.type === "switch") {
    const t = s.you[action.idx];
    if (t && !t.down && isAlive(t.cinder) && action.idx !== s.activeYou) {
      s.activeYou = action.idx;
      s.log.push({ actor: "you", text: "switch" });
    }
    foeTurn(s, run, rng); // switching costs the turn (Pokémon rule)
    finishRound(s);
    return;
  }

  if (action.type === "catch") {
    // One attempt per wild (DESIGN: a single chance to kindle it). Once spent
    // — success or fail — there is no second try this battle.
    if (s.setup.canCapture && !s.triedCatch) {
      s.triedCatch = true;
      const f = s.foe;
      const weaken = 1 - f.coherence / f.maxCoherence;
      const soft = hasCond(f, "rattled") || f.coherence < f.maxCoherence * 0.15 ? 0.15 : 0;
      const pull = 0.25 * keenness(me.cinder);
      const p = clamp(0.05 + 0.55 * weaken + soft + pull, 0.02, 0.92);
      if (rng.chance(p)) {
        s.done = true;
        s.result = "captured";
        s.log.push({ actor: "you", text: "catch-ok" });
        return;
      }
      s.log.push({ actor: "you", text: "catch-fail" });
    }
    foeTurn(s, run, rng); // a spent/blocked attempt still wastes the turn
    finishRound(s);
    return;
  }

  // action.type === "move"
  const picked = me.loadout.find((m) => m.id === (action as { moveId: string }).moveId) ?? me.loadout[0];
  const move = affordableMove(me, picked); // no breath for it → a free fallback
  const foeMove = foeChooseMove(s, rng);
  const youFirst =
    move.priority !== foeMove.priority
      ? move.priority > foeMove.priority
      : initiative(me.cinder, rng.nextFloat() * 0.05) >= initiative(s.foe.cinder, rng.nextFloat() * 0.05);

  const acts: (() => void)[] = [
    () => resolveMove(s, run, rng, me, s.foe, move, "you"),
    () => {
      if (s.foe.coherence > 0) resolveMove(s, run, rng, s.foe, s.you[s.activeYou], foeMove, "foe");
    },
  ];
  if (youFirst) acts[0](), acts[1]();
  else acts[1](), acts[0]();

  finishRound(s);
}

function foeTurn(s: BattleState, run: RunState, rng: Rng): void {
  if (s.foe.coherence <= 0) return;
  resolveMove(s, run, rng, s.foe, s.you[s.activeYou], foeChooseMove(s, rng), "foe");
}

function bleed(c: Combatant): void {
  // Decoherence Cascade: a per-turn coherence bleed (DESIGN.skills §4/§5).
  if (c.conds.some((a) => a.cond === "decohering")) {
    c.coherence = Math.max(0, c.coherence - Math.max(1, Math.round(c.maxCoherence * 0.06)));
  }
}

function regen(c: Combatant): void {
  // Slow breath back each round (the mana trickle) — far less than any
  // costed skill, so recovery/utility still can't be chained.
  if (c.cinder.vitality > 0) c.cinder.vitality = clamp(c.cinder.vitality + BATTLE_REGEN, 0, 1);
}

function finishRound(s: BattleState): void {
  bleed(s.you[s.activeYou]);
  bleed(s.foe);
  regen(s.you[s.activeYou]);
  regen(s.foe);
  // faint checks
  if (s.you[s.activeYou].coherence <= 0) {
    s.you[s.activeYou].down = true;
    const next = s.you.findIndex((c) => !c.down && isAlive(c.cinder));
    if (next >= 0) s.activeYou = next;
  }
  for (const c of s.you) tickConds(c);
  tickConds(s.foe);
  s.turn += 1;
  endIf(s);
}

// --- resolution → run ------------------------------------------------------

// Apply the staked-loss permadeath beat (bible §9) and emit the run outcome.
// The scene then passes this to applyEncounterOutcome (campDamage/capture/bond).
export function finalizeBattle(s: BattleState, run: RunState, staked: boolean): EncounterOutcome {
  const fielded = s.you[s.activeYou]?.cinder ?? run.circle[0];

  // Experience (DESIGN.skills §9): win/capture only. The fielded fire earns
  // full XP, the rest of the alive Circle a ¼ trickle. Pure/deterministic;
  // gainXp caps at LEVEL_MAX and ignores dead fires. Ephemeral by design.
  // Winning absorbs the wild's essence → MORE xp than capturing (which keeps
  // it whole) — capture pays only CAPTURE_XP_MUL of the base.
  if (s.result === "win" || s.result === "captured") {
    const k = s.setup.kind;
    const base = 4 + s.setup.foe.level * 2 + (k === "rival" ? 6 : k === "peer" ? 3 : 0);
    const xp = s.result === "captured" ? Math.round(base * CAPTURE_XP_MUL) : base;
    const lead = s.you[s.activeYou];
    if (lead) gainXp(lead.cinder, xp);
    const trickle = Math.round(xp * 0.25);
    for (const c of s.you) {
      if (c !== lead && !c.down && isAlive(c.cinder)) gainXp(c.cinder, trickle);
    }
  }

  // Essence absorption: beating a WILD fire (not a person, not a capture) has
  // a chance to take one of its techniques into the fielded fire — a windfall
  // (no level gate; the ≤4 knownLoadout cap bounds it). Deterministic from the
  // battle identity (its own seeded rng — never touches run._rng).
  if (s.result === "win" && s.setup.kind === "wild") {
    const cands = s.foe.loadout.filter((m) => !isAnchor(m) && !fielded.skills.includes(m.id));
    if (cands.length > 0) {
      const rng = new Rng(seedFrom("absorb:" + s._runName + ":" + s._nodeId + ":" + s._nonce));
      if (rng.chance(ABSORB_CHANCE)) fielded.skills.push(cands[rng.nextInt(cands.length)].id);
    }
  }

  // Persist battle wear run-wide (DESIGN.md §8): each player fire keeps its
  // remaining coherence as a fraction; camp rest restores it to 1. Runs for
  // every result so damage carries between fights. (A staked-loss fire is
  // re-embered fresh below — its written frac is harmless/discarded.)
  for (const cu of s.you) {
    cu.cinder.coherenceFrac = clamp01(cu.coherence / Math.max(1, cu.maxCoherence));
  }

  if (s.result === "captured") {
    // The wild's body becomes yours (DESIGN.md §7 — capture as loot drop):
    // inherit the foe's level, its non-anchor techniques (capped at 2 — the
    // anchors occupy the other two loadout slots), and the coherence wear
    // from the catch. The new wild-pool name seeds the identity; everything
    // else is run-scoped state lifted off the foe. Vitality is intentionally
    // not inherited — it stays at the kindle default so a thorough weakening
    // doesn't punish the catch (the player ground the foe's mana down on
    // purpose to make the catch land).
    const foeC = s.foe.cinder;
    const inheritedSkills = s.foe.loadout
      .filter((m) => !isAnchor(m))
      .map((m) => m.id)
      .slice(0, 2);
    const captured: CapturedSnapshot = {
      name: s.setup.captureName,
      level: foeC.level,
      skills: inheritedSkills,
      coherenceFrac: clamp01(s.foe.coherence / Math.max(1, s.foe.maxCoherence)),
    };
    return {
      campDamage: 0, // a clean capture costs the tribe nothing
      captured,
      bondMoment: staked && run.circle[0].bonded
        ? `staked all and took ${s.setup.captureName}`
        : `kindled ${s.setup.captureName} from the wild`,
    };
  }
  if (s.result === "win") {
    // Winning never bleeds the tribe — only losses overrun the camp.
    const out: EncounterOutcome = { campDamage: 0 };
    if (run.circle[0].bonded) out.bondMoment = `out-read ${s.setup.foeName} at the ridge`;
    return out;
  }
  if (s.result === "lose") {
    if (staked) extinguishFire(run, fielded); // the snuff (bonded → memorial + re-ember)
    // Softened (PROVISIONAL): a loss is a real blow but not a 2-strike end —
    // the tribe takes several to be overrun. Staked loss costs less (the fire
    // paid with itself). Felt-surfaced (no number) so the drain is legible.
    return { campDamage: staked ? 0.15 : 0.2 };
  }
  // fled / walked
  return { campDamage: s.result === "fled" ? 0.05 : 0 };
}

// --- helpers ---------------------------------------------------------------

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
function clamp01(x: number): number {
  return clamp(x, 0, 1);
}
function clampInt(x: number, lo: number, hi: number): number {
  return Math.round(clamp(x, lo, hi));
}
