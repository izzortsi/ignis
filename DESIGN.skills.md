# Ignis — Skills & the Informational Type Wheel (proposal)

Status: proposal, iteration 1. Companion to `DESIGN.md` (the GDD); extends
**§5 the Reading engine** and **§7 Cinder battle**. Lore source of truth stays
`lore/timeline.md` (iteration 7).

Markers (same as DESIGN.md): DECIDED / PROVISIONAL / OPEN / LIBERTY.

Meta-decisions for THIS document (from the 2026-05-18 conversation):
- DECIDED: the type system is a **4-type wheel** (Entropy / Negentropy / Signal
  / Noise).
- DECIDED: **move-only typing** — moves carry a type; Cinders do NOT. The wheel
  resolves between the attacker's move type and conditions (e.g.
  `entropy-vulnerable`) / the defender's last move type. No per-Cinder type.
- DECIDED: **no STAB** (own-type bonus). Moot under move-only typing anyway.
- DECIDED: the move's **type IS shown** in the UI as a non-numeric flavor
  label (it carries no number → does not break the §1.4 firewall).
- DECIDED: wheel multipliers — **strong ×1.2**, weak **×0.83** (≈1/1.2),
  neutral ×1.0. `entropy-vulnerable` (set by Negentropic Read) = Entropy-type
  moves do **×2.1** vs that foe while it lasts (revised 2026-05-18 from ×1.2 —
  the Read→Blast combo is the payoff).
- DECIDED (2026-05-18): skills are **taught by the ancient fire** (the Hearth),
  not auto-granted by level. ONE teach per camp visit; any Circle fire;
  eligibility = the existing level/bond/spectral readiness. Foes stay
  level-derived (NPCs). Taught skills are run-ephemeral (no `meta`/persist).
- DECIDED: the **starting learnset is exactly the two locked skills**
  (Negentropic Read, Entropic Blast) — they anchor every loadout. The rest of
  §4 is now **implemented** and learned via the Hearth (no longer a backlog).
- DECIDED: an **experience system** is in scope (§9) — the level/xp ladder
  already exists in `cinder.ts`; the gap is that battles grant no XP.
- IMPLEMENTED (2026-05-18): the wheel + the two starter skills + the
  battle→XP grant are built and headless-tested (126/126). What landed:
  `WheelType`/`wheelMul` (4-cycle ×1.2/×0.83/×1.0), `Condition`
  +`entropy-vulnerable`, `Technique.type` (all `MOVE_POOL` typed), the two
  starters (`negentropic-read`, `entropic-blast`), the wheel + vulnerability
  in `resolveMove`, XP in `finalizeBattle` (win/capture; fielded full + ¼
  Circle trickle; ephemeral), `typeWord`/`condWord` felt, and the BattleEncounter
  type label + felt growth line. (The full §4 set is now implemented — below.)
- CORRECTION (2026-05-18): the two starters are the **only L1 moves** and they
  **anchor** every loadout, so a fresh fire has EXACTLY those two.
- IMPLEMENTED (2026-05-18): the legacy generic kit (press/bank/guard/
  native-press/mirror-press/feint/stoke/keen-press/scatter) is **removed**
  entirely and replaced by the §4 designed skills. `MOVE_POOL` is now: the two
  starters + Maxwell's Cut, Shannon Jam, Error-Correct, Decoherence Cascade,
  Anneal, Negentropic Siphon, Compression Burst, Chirality Lock, Landauer's
  Toll, Joint Read. New `Technique` levers `pierce`/`siphon`/`compresses`/
  `clears`; new conds `jammed`/`decohering`/`annealed`/`signal-locked` with
  felt words; the bleed/cleanse/mitigation/lock mechanics in `resolveMove` &
  `finishRound`. PROVISIONAL learn curve L1→8; readiness still gates, the
  Hearth still teaches one/camp. Headless-tested (battle.test.ts 26, +felt).
- CORRECTION (2026-05-18, "gaining skills too fast"): leveling no longer
  auto-grants moves to PLAYER fires. New API in `battle.ts`:
  `Cinder.skills: string[]` (taught ids, run-ephemeral), `teachableMoves(c)`
  (eligible-by-readiness, not anchor, not known), `teachSkill(c,id)`,
  `knownLoadout(c)` (anchors + taught, ≤4). `combatant(c, player)` →
  player uses `knownLoadout`, foe keeps level-derived `defaultLoadout`. The
  Hearth (`CampScene` `hearth` dialog) is the teaching UI: pick a Circle fire,
  teach ONE eligible skill per camp visit. Headless-tested (battle.test.ts).

- IMPLEMENTED (2026-05-18): the **mana model** — recovery was too strong, so
  **vitality IS the in-battle budget** (no new field; the user's call). Costs
  raised: the two starters are **free** (cost 0); skills cost breath;
  Error-Correct is heavy (`costVitality` 0.35, no longer self-fuels — the bank
  branch lost its `feedReading`) so it can't be chained. `canAfford` gates
  selection (player → free fallback; foe AI filters to affordable); a move can
  NEVER drain a fire to death (`DEATH_FLOOR` 0.04 — only a staked loss / camp
  neglect reaches 0); slow `BATTLE_REGEN` 0.01/round (PROVISIONAL — lowered
  from 0.03; recovery is rationed). The "fuel" stat bar
  doubles as the felt mana gauge; unaffordable moves dim + "no breath for it".
  Tuning PROVISIONAL. Headless-tested (battle.test.ts).
- IMPLEMENTED (2026-05-18): **XP/stat/vitality rework.** (a) XP is now
  **battle-only** — `feedReading` no longer calls `gainXp`; `XP_PER_READING`
  removed; `finalizeBattle` is the sole source. (b) Learning at the Hearth
  **spends XP**: `teachCost(m)=4+3·(minLevel-1)` (PROVISIONAL), `canTeach`,
  `teachSkill` refuses < cost and never drops level; felt via `teachFelt`
  (no number); the teach button dims when unaffordable. (c) `maxCoherence`
  & `resilience` **decoupled from vitality → level-driven** (vitality = pure
  mana). (d) Vitality gets its own prominent `VitalityGauge` ("breath") beside
  Coherence; the "fuel" stat row removed. Core headless-tested (148 green);
  the gauge/Hearth-button/CSS are Solid → unverified-by-build.
- IMPLEMENTED (2026-05-18): **essence absorption + win/capture XP.** Beating a
  WILD fire: full XP + `ABSORB_CHANCE` (0.25, PROVISIONAL) to push one of the
  wild's non-anchor, not-known techniques onto the fielded fire's `skills` —
  a **pure windfall** (no level gate; the free counterpart to the Hearth's
  XP-cost teach, bounded by the ≤4 loadout cap). Capturing keeps it whole →
  `CAPTURE_XP_MUL` (0.5, PROVISIONAL) of the XP, no absorb. Wild-only;
  deterministic (own seeded rng); felt-only via `absorbFelt`. Tests: a wild
  win can absorb / capture & duel never / win-XP > capture-XP / deterministic
  per battle identity. Core headless-tested (154 green).

Nothing here overrides DESIGN.md §1.4 (the felt / no-numbers firewall) or §5
(one Reading classifier). The wheel is an *orthogonal damage/effect multiplier*,
never a second to-hit classifier.

---

## 1. Why a type wheel at all

The cinders are informational beings — plasma minds whose "HP" is a coherence
reservoir (signal-pole separation; DESIGN §7, bible §8/§12). A fight is two
minds forcing decoherence on each other. "Entropy-type" / "weaker to entropy"
(the brief) only mean something if disorder, imposed order, meaning, and
randomization are *distinct levers that interact*. A 4-type wheel makes the
informational nature mechanical instead of cosmetic.

LIBERTY-minor (L5): naming combat moves after information theory
(Maxwell/Shannon/Landauer) is a stylistic stretch on the bible's register;
flagged for accept/reject. The *mechanics* map to canon levers (coherence,
spore/noise, manner, burn-bright) — no new physics claimed.

---

## 2. The wheel — DECIDED (4 types), relationships PROVISIONAL

Four informational types:

- **Entropy** — disorder; forces decoherence. The destructive baseline.
- **Negentropy** — imposed order; Maxwell-demon sorting, error correction.
- **Signal** — coherent meaning; a precise, pinning read (kin to chirality).
- **Noise** — randomization; raising the foe's noise floor, jamming.

PROVISIONAL 4-cycle (each type is strong vs exactly one, weak vs its
predecessor):

```
 Entropy  ──beats──▶ Negentropy ──beats──▶ Noise ──beats──▶ Signal ──beats──▶ Entropy
 (disorder           (clean-up            (jamming          (a precise read
  overwhelms           cancels              drowns            anneals/pins
  imposed order)       noise)               the signal)       disorder)
```

So: Entropy > Negentropy > Noise > Signal > Entropy. Each type is weak to the
one that beats it.

Multipliers — DECIDED: strong **×1.2**, weak **×0.83** (≈1/1.2), neutral
**×1.0**.

Composition (keeps "one engine", DESIGN §5/§7) — DECIDED **move-only typing**,
so there is no `foeType`; the wheel resolves the attacker's move type against
(a) the defender's **last move type** (you out-typed their approach), and
(b) **conditions** that confer a transient type-weakness:

```
damage = ReadingQuality(miscalibration)      // unchanged — the single classifier
       × SPECTRAL_FIT(spectral, sample)      // unchanged — chirality, single source
       × chiralStanceResonance               // unchanged
       × typeWheel(moveType, foeLastMoveType)// NEW — orthogonal; ×1.0 if foe has not acted
       × condTypeMod(moveType, conds)        // NEW — e.g. entropy-vulnerable → Entropy ×2.1
```

With only the two starting skills, the wheel manifests almost entirely through
`condTypeMod` (Negentropic Read → `entropy-vulnerable` → Entropic Blast ×2.1);
the move-vs-last-move clash matters once more typed moves exist.

DECIDED: **move-only typing** (no per-Cinder type). DECIDED: **no STAB**.
DECIDED: the move's type **is shown** in the UI as a non-numeric label.

---

## 3. The two locked skills (formalized)

`Technique` fields (existing `core/battle.ts`): `id, name, kind, stance,
power, accuracyBias, costVitality, priority, status?, learn{minLevel,
minBond?, spectral?}`. Proposed additions: a `type` field (the wheel) and new
`Condition`s (§5).

- **Negentropic Read** — *type: Negentropy · kind: feint (utility)*. Reads the
  foe's negentropic structure and exposes it: applies `entropy-vulnerable`
  (foe takes amplified Entropy-type damage for N turns). `power: 0`,
  low `costVitality`, no priority. Felt line: *"You read the order in it; its
  seams show."*
- **Entropic Blast** — *type: Entropy · kind: press (damage)*. The
  bread-and-butter single-target strike. Standard `power`, modest cost.
  Synergy: lands much harder into `entropy-vulnerable`.

---

## 4. The informational skill set — IMPLEMENTED (2026-05-18)

IMPLEMENTED: this table is the live `MOVE_POOL` (legacy generic kit removed).
The two starters anchor every loadout; the rest are gated by
`learn{minLevel,minBond?,spectral?}` *readiness* and **taught at the ancient
fire** (one per camp visit) — leveling no longer auto-grants moves to player
fires; ≤4 loadout per fire (DESIGN §7). UI shows the felt blurb + type label
(no numbers, ever).

| Skill | Type | kind | Effect (engine lever) |
|---|---|---|---|
| Negentropic Read | Negentropy | feint | foe → `entropy-vulnerable` (N turns) |
| Entropic Blast | Entropy | press | single-target damage |
| Maxwell's Cut | Negentropy | press | damage that ignores part of foe `resilience`; high `accuracyBias` |
| Shannon Jam | Noise | feint | foe → `jammed` (its Reads scatter — accuracy down) |
| Error-Correct | Negentropy | bank | restore own coherence; cleanses one debuff; `costVitality` net‑negative |
| Anneal | Signal | guard | self → `annealed` (+resilience, priority) and clears `decohering` |
| Decoherence Cascade | Entropy | scatter | foe → `decohering` (coherence bleeds N turns) |
| Negentropic Siphon | Negentropy | press | damage foe coherence, restore a fraction to self |
| Compression Burst | Entropy | press | `power` scales with foe disorder (low coherence / debuff count) |
| Landauer's Toll | Entropy | press | high `power`, steep self `costVitality` (erasing info costs energy) |
| Chirality Lock | Signal | feint | foe → `signal-locked` (can't switch; your next hit super-effective vs its chirality) |
| Joint Read | Signal | joint | *(exists)* re-typed Signal; ensemble read with a bench fire (bible §16 Q12) |

Design intents:
- Negentropy = control/repair (sorting, error-correction) — utility/sustain.
- Entropy = damage, esp. DoT and execute (`Compression Burst`) — the
  aggressive line; rewards setting `entropy-vulnerable` / `decohering`.
- Noise = accuracy denial (`jammed`) — disrupts the foe's Reading.
- Signal = tempo/lockdown (`signal-locked`, `Anneal`) — leans on the existing
  chirality system; counters Noise.
- Counterplay loop: Entropy DoT ↔ Negentropy `Error-Correct`/`Anneal`;
  Signal lockdown ↔ Noise `Shannon Jam`.

---

## 5. New `Condition`s required (turn-scoped, felt-only)

Extends the existing union (`rattled | dazzled | spore-fouled | stoked |
banked`). Each needs a `battle-felt.ts` word (no numbers):

- `entropy-vulnerable` — "its order is laid bare"
- `jammed` — "its read swims in noise"
- `decohering` — "it is coming apart" (damage-over-turn)
- `annealed` — "it has set hard" (resilience up)
- `signal-locked` — "it is pinned to its hand" (no switch; chirality exposed)

OPEN: stack/refresh rules (refresh duration vs ignore vs stack intensity).
PROVISIONAL: refresh duration, never stack — keeps the felt UI legible.

---

## 6. Determinism & firewall (unchanged invariants)

- Same seeds (`battle:` identity, `battlex:` per-turn) → identical outcomes;
  the type wheel is pure data, adds no RNG.
- The type wheel is one small table (4×4), single source of truth, like
  `SPECTRAL_FIT`. No hand-tuned per-move matchup table.
- UI: every skill's effect surfaces only as felt words / abstracted gauges via
  `battle-felt.ts`. Type names MAY appear as flavor labels (they carry no
  number), pending your call on whether even the type is shown.

---

## 7. Implementation plan — IMPLEMENTED (2026-05-18)

1. `core/battle.ts`: add `type` to `Technique`; `WheelType` union; a 4×4
   `TYPE_WHEEL` table + `wheelMul(a,b)`; extend `Condition`; thread the
   multiplier into the damage step after `SPECTRAL_FIT`; apply new statuses in
   `step`/`finalizeBattle`.
2. `core/battle-felt.ts`: felt words for the new conditions; a `typeFelt` if
   types are surfaced.
3. `core/battle.test.ts`: wheel relationships (strong/weak/neutral, the cycle);
   `entropy-vulnerable` amplifies only Entropy; `decohering` ticks; determinism
   unchanged; one-classifier invariant still holds (a press still equals a
   direct `performReading` on the same seed, modulo the new pure multiplier).
4. `BattleEncounter.tsx`: move cards already show felt reliability/cost; add the
   condition chips for the new statuses (felt only).
5. DESIGN.md: fold the wheel + move-only typing into §7; add felt vocabulary
   and the shown type-label to §14.
6. Experience (§9): grant XP in `finalizeBattle`; felt growth line; the
   cross-run persistence choice (see §9 OPEN).

---

## 8. Open questions — RESOLVED (2026-05-18)

1. RESOLVED: **move-only typing** (no per-Cinder type).
2. RESOLVED: **no STAB**.
3. RESOLVED: the move's type **is shown** (non-numeric label).
4. RESOLVED: strong **×1.2**, weak **×0.83**, neutral ×1.0;
   `entropy-vulnerable` → Entropy ×2.1.
5. RESOLVED: starting learnset = **only the two locked skills**; the §4 set is
   now implemented and Hearth-taught.

The experience-system forks (§9 O9.1–O9.4) are also RESOLVED. No OPENs remain;
the spec is complete and build-ready, implementation still gated on your go.

---

## 9. Experience system (proposal)

DECIDED in scope. What ALREADY exists in `core/cinder.ts` (do not rebuild):

- `Cinder.level` (1..`LEVEL_MAX`=12), `Cinder.xp`, `xpToNext(level)=4+level*3`
  (L1→7, L2→10, …), `gainXp(c,n)` (rolls over, capped, permanent),
  `cinderStage(c)` (3 levels/stage — note petart art now uses `canonStage`,
  separate), `xpProgress(c)` (level/xp/need/frac).
- Level already feeds: `readProfile` acuity (`LEVEL_ACUITY`), and in
  `battle.ts` `maxCoherence` / `power` / `initiative`, and `learnableMoves`
  gating (`learn.minLevel`).

THE GAP (the whole of "we need an experience system"): **`gainXp` is called
only by `feedReading` (XP_PER_READING=1). Battles grant no XP** — winning,
capturing, or out-reading a foe does not grow the fire. Creature-collector
progression is therefore missing.

CORRECTION (2026-05-18 — superseded): the above describes the OLD state.
`feedReading` no longer grants XP and `XP_PER_READING` is deleted; XP is now
**battle-only** (`finalizeBattle`), drives leveling, AND is spent to learn
skills at the Hearth (`teachCost`/`canTeach`/`teachSkill`). See the
IMPLEMENTED bullet in the meta log above.

Proposed fill (PROVISIONAL):

- Grant XP in `finalizeBattle` on a decisive result, scaled by the foe:
  `xp = round(BASE + foe.level * K + kindBonus)` where `kindBonus` favors
  rival > peer > wild and a capture grants a share too. Pure, deterministic,
  no RNG.
- Surface growth as a **felt** line only (no numbers): `growthFelt` →
  "reads sharper" / "steadied" / "comes into its own" (a level-up beat). The
  type label is shown (DECIDED §2); raw level/xp never are (§1.4).
- Level-ups raise `learn` *readiness*; the skill is only gained when **taught
  at the ancient fire** (one per camp visit) — not auto-granted. The §4 skills
  are authored and implemented.

RESOLVED (2026-05-18) — build-ready:

- O9.1: RESOLVED — **fielded fire earns full XP; the rest of the alive Circle
  gets a shared trickle** (¼, rounded).
- O9.2: RESOLVED — **win/capture only**. Loss and flee grant **0** (sharper
  stakes; a bad run sets you back).
- O9.3: RESOLVED — **ephemeral**. `meta.caught` stays `{name,stage}`; caught
  fires re-`kindle` at L1 every run. No new persisted field, no migration.
  Only the bonded line + dex / memorial / memories persist (roguelite-pure).
- O9.4: RESOLVED (PROVISIONAL numbers, tunable in one place):
  - `xp = BASE + foe.level * K + kindBonus`, `BASE = 4`, `K = 2`.
  - `kindBonus`: wild `+0`, peer `+3`, rival `+6`.
  - A **capture** pays the fielded fire the same as a win (the foe joins the
    Circle freshly kindled at L1 — see O9.3).
  - **Circle trickle**: every *other* alive Circle fire gets
    `round(fieldedXp * 0.25)` via `gainXp` (benched fires still drift up).
  - Loss / flee: `0`.
  - Sanity vs `xpToNext=4+level*3` (L1→7): an early wild (foe ~L2) →
    `4+4+0=8` ≈ one level; a deep rival (foe L12) → `4+24+6=34` ≈ several —
    harder fights, faster growth, by design.

All §9 forks resolved. With §2/§3/§8 also resolved, the full spec (wheel +
two starters + experience) is built. §7 was the plan; it has been executed —
the §4 informational skill set is the live battle content, headless-tested
(battle.test.ts, full vitest green).
