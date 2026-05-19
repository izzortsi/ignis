# Ludus Ignis — Game Design Document

Status: draft, iteration 1 (the game pivot).

This document defines the **game**. The lore source of truth is the in-repo
bible `lore/timeline.md` (iteration 7 — teaching mission excised). The original
tutor bible at `/workspace/ludus-ignis/lore/timeline.md` is left untouched as a
historical record. Precedence:
- Lore/world questions → `lore/timeline.md` (iteration 7) wins.
- Game mechanics → this document wins.

Markers (same convention as the bible):
- DECIDED — settled in conversation; change requires explicit revisit.
- PROVISIONAL — chosen to make the draft concrete; expect revision.
- OPEN — not yet decided.
- LIBERTY — a stretch of the bible's hard-SF canon; flagged for the user to accept or reject.

---

## 0. The Pivot

DECIDED: Ludus Ignis is no longer a teaching tool. Removed: the probability curriculum,
exercise banks, lessons, knowledge/mastery tracking, study mode, the 21-family taxonomy,
the PDF pipeline, concept-name revelation. It is now a **roguelite creature-collector with
tamagotchi care**, set in the bible's world.

What survives the cut: the world, A Leitura's *felt* (qualitative, never-numeric) form, the
Cinder bond, the migration spine, the bestiary of mirror-life. The probabilistic *shape* of
survival is kept as game feel; it is never shown as arithmetic.

A separate task (§12) excises the teaching mission from the bible as iteration 7.

---

## 1. Pillars (locked 2026-05-16)

1. DECIDED — **Felt Reading is the core loop.** The fire returns a qualitative band under
   noise; the player decides eat / burn / quarantine / retest. No number is ever shown.
2. DECIDED — **New sibling repo.** Shares only the lore with `/workspace/ludus-ignis`.
   Cinder / Reading / RNG reimplemented lean and game-first.
3. DECIDED — **Collection = brood + dex.** A party of fires you raise and risk, hunting a
   bestiary of species you catalogue.
4. DECIDED — **One Reading engine; a numeric battle on top, a felt UI over it.**
   Wild creatures meet you as single **encounters** (no tide wave) and a
   turn-based **Cinder battle** (trainer/capture) both call the single Reading
   engine. The battle engine is fully numeric (stats, coherence, type-fit,
   status, capture odds); the UI shows **only felt language + abstracted gauges
   — never a digit, %, level, or HP** (cross-ref §5, §7, §14; bible §10). The
   no-numbers firewall is `src/core/battle-felt.ts`, unit-tested.

---

## 2. Brood vs. the one-Cinder canon — DECIDED: The Circle

The bible (§8–9) is emphatic: an apprentice has exactly **one** bonded Cinder — the
voice-in-head, the lifelong bond, the permadeath stakes. "Both: brood + dex" needs a party.
Three ways to reconcile:

- **A — The Circle (RECOMMENDED).** The apprentice keeps exactly one *bonded* personal
  Cinder (canon intact: the tamagotchi, the voice, the grievable death). The party is a
  **circle of unbonded fire-patterns** — stranded plasma kindled from ruins, lightning
  snags, abandoned hearths along the migration. They are tended, not bonded: expendable,
  trait-bearing, they gutter without the emotional/meta cost of the true Cinder's death.
  Hard-SF: bible §8 already has stranded patterns seeding any continuous fire; deep
  informational entrainment (the *bond*) takes years (§9), so several small fires can be
  *carried* while only one is *bonded*. This **strengthens** the roguelite — it gives a
  diegetic reason for an expendable party and one precious anchor. Tag: LIBERTY-minor
  (multi-fire tending); the bond rule itself stays canon.
- **B — Full brood.** Drop the one-Cinder rule; apprentices canonically raise a brood.
  Mechanically simplest, biggest canon break, dilutes the tamagotchi intimacy.
  Tag: LIBERTY-major.
- **C — Sequential.** One Cinder at a time; the "collection" is a memorial gallery of past
  Cinders + the species dex; no party in combat. Closest to canon but under-delivers on
  the "party" you chose.

DECIDED: **A — The Circle.** One bonded Cinder (canon) + an expendable circle of unbonded
wild-kindled fires. Tag: LIBERTY-minor (multi-fire tending); the bond rule stays canon.

---

## 3. Feeding the fire, with the math gone — DECIDED: Readings are the food

Bible §8: fires are sustained by ordered information work; Bayesian work was the
"highest-quality food." With the curriculum removed, feeding can no longer be solving
probability exercises. Reframings:

- **A — Readings are the food (RECOMMENDED).** Resolving real chirality uncertainty *is*
  ordered information work. Performing Readings sustains the fire; a quiet stretch with no
  Readings starves it. Collapses tamagotchi + core loop + battle onto one substrate. No
  separate minigame. Hard-SF intact (§8).
- **B — Abstract ordering interaction.** A light non-math pattern/sorting ritual at camp
  feeds the fire. Keeps a distinct care beat; adds a minigame to design and balance.
- **C — Fuel only.** Drop the information-substrate idea; fires need wood + rare good fuel.
  Simplest; loses the bible's most distinctive idea (cognition as combustion substrate).

DECIDED: **A — Readings are the food.** Performing Readings sustains the fire; a quiet
stretch with no Readings starves it. One substrate for tamagotchi + core loop + battle.

---

## 4. Core loop

A **run** is one migration push along the bible's authored stage spine (§7: PNW → equator;
difficulty scales with latitude — the bible already encodes the roguelite difficulty curve).

Per stage, a day cycle:
1. **Travel** — move toward the next camp; procedural events (forage, weather, scout reports).
2. **Encounter** — tall grass / a duel site triggers a turn-based Cinder
   battle (§7); water still triggers a tide-style Reading (§6).
3. **Camp** — tend the brood: Readings feed the fires (§3-A); the bonded Cinder speaks;
   lore drops; the dex is updated.

Run ends on tribe-wipe (camp overrun in a tide) or migration failure. Bonded-Cinder death
is non-fatal to the run (canon §9) but a major setback.

PROVISIONAL: stage count and pacing follow the bible's 8 stages; tune later.

---

## 5. The Reading engine (the one shared system)

Single noisy-classifier system the water Reading (§6) and the turn-based battle
(§7) both call. The battle is a numeric layer *on* this engine — every press is
a `performReading`/`jointReading` scored by `miscalibration`; the player still
sees only felt bands (§1.4 firewall).

- A sample/entity has a hidden truth: `native` / `mirror` / `inert (sem mão)`.
- The active fire returns a **felt band** (bible §10): *de nossa mão / parece de nossa mão /
  o fogo hesita / parece tocada / tocada / sem mão*. Never a number.
- Verdict noise is modulated by (bible §11, all canon): fire vitality, fire spectral
  "type", the fire's Reading manner (confident/cautious/histrionic), ambient spore load
  (rises southward), wind, time of day, sample type.
- Player decision: **eat/pass / burn / quarantine / retest** (retest with another circle-fire
  = the bible's joint Reading, §16 Q12 — an ensemble that sharpens the verdict).
- Consequences are NPC-borne and real (canon §9): a passed mirror entity harms the
  camp/tribe; a burned native wastes a resource and seeds a "hungry winter" beat.

This is the entire skill expression: reading a noisy sensor and deciding under pressure.
The player gets better; there is no mastery stat.

---

## 6. Tide / water Reading (PvE wilds)

DECIDED: no tide *wave* — a water encounter is a single creature presented for a
felt-band Reading (decide pass/burn/quarantine). Shares the Reading engine with
the battle (§7). The felt-UI rule (§1.4) applies here too — note the legacy
`TideEncounter.tsx` numeric stat-sheet violates it and is flagged for cleanup.

---

## 7. Cinder battle + capture — DECIDED (2026-05-18): turn-based

Your fielded fire vs. another fire — a wild stranded pattern, a peer, or a rival
tribe's fire (bible §8 distant fires answering, §11 peers competing). A
**turn-based** contest grounded as plasma minds destabilising each other's
chirality read (`src/core/battle.ts`):

- **Stats** are pure functions of existing Cinder fields — coherence
  (HP-equiv), power, keenness, resilience, initiative. Never shown.
  DECIDED (2026-05-18): **vitality decoupled** — `maxCoherence` and
  `resilience` are now **level-driven** (bond still grows maxCoherence;
  baseAcuity/burn-bright still feed resilience). Vitality is purely the mana
  budget; spending it no longer shrinks the HP pool mid-fight.
- **One engine**: every offensive act is a Reading (`performReading`/
  `jointReading`), scored by `miscalibration`. To-hit + damage come from the
  Reading; no second classifier.
- **Type-fit** = the existing `SPECTRAL_FIT` matrix (spectral × sample) × a
  small chirality-stance resonance. No new hand-tuned table.
- **Learnable move pool** (`MOVE_POOL`): techniques gated by level/bond/spectral
  (press, keen-press, our-hand/touched press, joint-read, feint, bank, stoke,
  scatter, guard); ≤4 deterministic default loadout per fire.
- **Status**: rattled / dazzled / spore-fouled / stoked / banked (turn-scoped);
  guttering / starved / burn-bright read through from Cinder state.
- **Party**: switch across the Circle (costs the turn). Faint = out for this
  battle (not death).
- **Capture** (wild only): weaken-then-kindle — **one attempt per battle**
  (`BattleState.triedCatch`; spent on success or fail, no second try); `p`
  rises as the foe's coherence frays; success → `EncounterOutcome.capturedName`
  (run.ts kindles + recordCaught); post-catch growth via the existing
  `level`/`gainXp` ladder.
- **Win vs. capture, vs a WILD fire** (DECIDED 2026-05-18): a kill **absorbs
  the essence** — pays full XP, and a chance (`ABSORB_CHANCE`, PROVISIONAL
  0.25) for the fielded fire to take one of the wild's techniques into its
  `skills` (pure windfall — no level gate; bounded by the ≤4 `knownLoadout`
  cap; run-ephemeral). A capture keeps the fire whole → only `CAPTURE_XP_MUL`
  (PROVISIONAL 0.5) of the XP, no absorb. Wild-only (duels are people: no
  absorb). Deterministic (battle-seeded; never touches `run._rng`). Surfaced
  felt-only via `absorbFelt` (like the growth line).
- **Stake** the fielded fire → a loss snuffs it (bonded → memorial + re-ember,
  `extinguishFire`, bible §9).
- **Determinism**: `seedFrom("battle:"+runName+":"+nodeId)` identity;
  `"battlex:"+…+":"+turn` per turn.

UI: `src/ui/encounter/BattleEncounter.tsx` (mirrors `TideEncounter.tsx`), all
state routed through `battle-felt.ts` — felt words + abstracted gauges only.
DECIDED (2026-05-18) — live felt gauges both sides: the Coherence Gauge and a
dedicated **breath/mana gauge** (vitality, `VitalityGauge` via
`barFelt(_, "vitality")` — its own prominent bar beside Coherence, drains as
skills are cast), plus four `barFelt` stat bands (bite/eye/hold/speed =
power/keenness/resilience/initiative) off `battle.statProfile` (normalized
0..1; UI never sees raw values). The redundant "fuel" stat row was removed.
Discrete bands + a word, never a number/% (§1.4 firewall). Conditions stay
felt chips; turn order stays `orderFelt`.

Superseded (kept for record): the original best-of-N calibration contest
(`core/duel.ts` / Canvas `scenes/duel.ts`), now deleted.

---

## 8. Tamagotchi / brood care

Per camp (§4 step 3): each fire's vitality decays in the field (battle move costs,
wrong-answer noise it must expel — bible §8). Readings feed it (§3-A). Low vitality →
**no breath for skills** (it is the mana budget; battle HP no longer scales with it
as of 2026-05-18) and noisier Readings → cascading failure. The bonded Cinder
additionally has the bond layer (memory of the run, habits, mood check-ins —
bible §9) that circle-fires lack.

DECIDED (2026-05-18) — camp is the recovery beat: returning to camp **rests** the
Circle, restoring each living fire's vitality toward full (PROVISIONAL `REST_GAIN`
0.4, capped — partial, NOT a full heal, so over-extending before camp still wears
you down). This is `cinder.restPeriod` (replaced the old neglect-decay
`endPeriod` in `run.tendFires`); a snuffed fire (vitality 0, e.g. a staked loss)
is not revived — it is still memorialised / dropped. (Historical: this fixed
"coherence doesn't recover after battles" when coherence was vitality-gated;
as of 2026-05-18 coherence is level-driven, so camp rest now restores the mana
budget rather than the HP cap.)

DECIDED (2026-05-18) — **battle wear persists run-wide**: a fire's current
coherence is kept as `Cinder.coherenceFrac` (0..1, default 1 at kindle); each
battle starts at the carried fraction and `finalizeBattle` writes the
remaining fraction back to the run's fires (every result). Fights now have
lasting cost between camps. **Camp rest restores coherence FULLY**
(`restPeriod` → `coherenceFrac = 1`; vitality stays partial `REST_GAIN`). A
fire carried to 0 is **benched** — `combatant` marks it `down`, `startBattle`
opens on the first fire that can fight; it recovers only at camp. Foes are
fresh per-encounter NPCs (always full). Determinism preserved (writeback is
pure; replay/`run._rng` tests green).

DECIDED (2026-05-18) — vitality is ALSO the in-battle budget (the "mana"
model; DESIGN.skills): skills spend breath, the two starters are free, a slow
per-round trickle returns, and a move can never self-snuff (`DEATH_FLOOR`).
This deliberately couples the two layers: a hard fight that burns lots of
skill-breath leaves the fire low until the next camp rest — recovery
(Error-Correct) is a rationed, costly choice, not a spammable heal.

---

## 9. Roguelite meta-persistence

Persists across runs:
- **The dex / almanac** (canon §12) — every species catalogued by a successful Reading.
- **The memorial** (canon §9 monument-mechanic) — every bonded Cinder that has died,
  named, with where it guttered.
- **Player skill** — the human gets better at calling bands. No stat, no XP bar.
- **Cinder XP** (2026-05-18) — earned **only from battle wins/captures**
  (`finalizeBattle`; Readings no longer trickle XP). It drives leveling
  (→ stats, skill readiness) AND is **spent** to learn skills at the Hearth
  (`teachCost`, one teach/camp). Felt-only in UI; never an XP number shown.

Run-scoped (lost on run end): the circle, consumables, camp state, the current bonded
Cinder's accumulated lore/traits.

OPEN: any permanent tribe/run upgrades beyond the above (currency? unlockable starting
fires?). Deferred until the core loop is felt.

---

## 10. The dex (bestiary)

Entries: mirror-cyano, mirror-fauna (yellow-husk birds, wrong-handed flora), native
species, inert decoys. Each entry: appearance, true class, the felt-bands it tends to
produce, and Reading-difficulty notes. Sourced from bible §5, §12. Filled by play.

---

## 11. Tech & architecture — DECIDED (revised 2026-05-18): TS + Solid.js + Vite + CSS

**Revision (2026-05-18):** the Canvas-2D-ASCII-vanilla decision below is
**superseded**. The game is being re-architected onto **TypeScript + Solid.js +
Vite + CSS**, matching `ludus-ignis`, so the original intro (and its dense
scene-art) ports verbatim and renders at native fidelity instead of being
downsampled into an ASCII grid. The Canvas `Screen`/`Scene` engine is retired.
Pure-logic modules (`rng, reading, cinder, run, routemap, localmap, tide, duel,
bestiary`) are **unchanged and reused**; only the render layer is rebuilt as
Solid/CSS components, scene by scene. Determinism (splitmix64 BigInt RNG,
FNV-1a seeding) is preserved — it lives in the logic layer.

Migration order: (1) Solid stack + verbatim ludus-ignis intro + a bridge that
keeps the Canvas game playable; (2) port route map; (3) local map / chapada;
(4) tide; (5) duel; (6) dex; then retire the Canvas bridge.

### Original decision (superseded, kept for the record)

The repo is `/workspace/ignis` (changeable). Stack options:

- **A — TS + Vite + Canvas 2D ASCII, vanilla (RECOMMENDED).** Matches the roguelite/ASCII
  heritage and the prior (deleted) `/workspace/ignis` line. Reuses known-good determinism
  (splitmix64 BigInt RNG, FNV-1a seeding — same seed → same run). Lean, no framework
  weight, PWA-capable.
- **B — TS + Solid.js + Vite.** Matches the existing `ludus-ignis` repo; easiest mental
  port of its Cinder/intro code. Heavier for a grid-render game.
- **C — A game engine (Phaser/Excalibur).** Faster juice/animation; larger dependency and
  determinism work.

DECIDED: **A — TS + Vite + Canvas 2D ASCII, vanilla.** Repo: `/workspace/ignis`.
Deterministic seeded runs (splitmix64 BigInt RNG, FNV-1a seeding); ASCII + light Unicode +
sparing colour per bible §16 Q7.

---

## 12. Build plan (phased; gated on your approval of §2, §3, §11)

1. Bible iteration-7: excise the teaching mission from `timeline.md` (lore-preserving).
2. Scaffold the new repo (stack per §11) — RNG, ASCII screen, scene loop, persistence.
3. Reading engine (§5) — the shared core, headless-testable first.
4. Cinder model (§2, §8) — bonded + circle, vitality, feeding = Readings (§3).
5. Run/stage structure (§4) + meta-persistence (§9).
6. Tide / water Reading (§6) — single-creature, no wave.
7. Cinder battle + capture (§7) — `core/battle.ts` + `core/battle-felt.ts`
   (done, headless-tested) + `ui/encounter/BattleEncounter.tsx` (Solid, gated
   on the §11 migration deps). Legacy `core/duel.ts` + `scenes/duel.ts` deleted.
8. Dex (§10) + intro/lore port from the bible.

---

## 13. Open questions

1. §2 — DECIDED: The Circle.
2. §3 — DECIDED: Readings are the food.
3. §11 — DECIDED: TS + Vite + Canvas ASCII vanilla; repo `/workspace/ignis`.
4. DECIDED: ships **fully English** (user override of the bible's Portuguese-first canon).
   No Portuguese surfaces anywhere — UI, prose, ritual terms, band names. Portuguese
   deferred entirely. English terminology in §14.
5. DECIDED: bonded-Cinder death mid-run continues the run on a fresh Hearth ember (canon §9);
   only tribe-wipe / migration failure ends a run.
6. OPEN: §9 — meta-progression beyond dex/memorial/skill (currency? unlockable starting
   fires?). Deferred until the core loop is felt.
7. DECIDED (2026-05-18): §7 battle is **numeric under the hood, felt-only in the
   UI** (turn-based, party-switch, learnable moves, weaken-then-catch). Legacy
   best-of-N duel deleted (`core/duel.ts`, `scenes/duel.ts`).
8. NOTE: `TideEncounter.tsx` prints raw Lv/%/xp — violates §1.4; cleanup pending.

---

## 14. Terminology (English) — PROVISIONAL, correct any term

Fully-English renderings of the bible's Portuguese in-world vocabulary. The
chirality = *handedness* metaphor is kept (it is literally what chirality means —
hard-SF accurate), so native life is "our-handed" and mirror life is "touched".

| Bible (PT) | Game (EN) | Meaning |
|---|---|---|
| A Leitura | the Reading | the polarimetric chirality ritual |
| a serpente verde | the green serpent | the equatorial aurora |
| a Brasa / Cinder | the Cinder | the bonded fire (already English in the bible) |
| de nossa mão | **of our hand** | strong native — safe |
| parece de nossa mão | **seems of our hand** | weak native — likely safe |
| o fogo hesita | **the fire hesitates** | ambiguous — hold / retest |
| parece tocada | **seems touched** | weak mirror — discard |
| tocada | **touched** | strong mirror — burn, don't handle |
| sem mão | **handless** | inert — no chirality to read |

Felt-distribution words (bible §10) are already English: certain / near-certain /
likely / balanced / uncommon / rare / vanishing.

**Battle-felt vocabulary** (§7 UI; the numeric engine never surfaces — see
`battle-felt.ts`):

| Engine fact | Felt rendering |
|---|---|
| coherence (HP) | whole / bright / steady / holding / wavering / guttering / all but out |
| effectiveness | the press bites deep / bites true / lands, no more / barely grazes / the touch slides off |
| a miss | the read scatters — nothing takes / wanders wide |
| move reliability·cost | a sure/steady/wild read · a light call / costs the fire dearly / the fire rests on it |
| initiative | your fire reads first / it is quicker / your reads cross |
| capture | the ember resists… wavers… leans toward your circle… it takes / it slips back to the dark |
| growth | reads sharper for this / steadied |
| status | rattled / scattered / spore-choked / stoked / banked / guttering / starved / burn-bright |
