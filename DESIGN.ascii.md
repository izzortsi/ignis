# Ludus Ignis — Cinder ASCII Art (design)

Status: design, iteration 1. Companion to `DESIGN.md` (the GDD) and
`DESIGN.skills.md`. Governs `src/core/petart.ts` (ported from
`/workspace/mochi/backend/app/services/pet_art.py`). Lore source of truth stays
`lore/timeline.md`.

Markers (same as DESIGN.md): DECIDED / PROVISIONAL / OPEN / LIBERTY.

Meta:
- DECIDED (2026-05-18): the silhouette arc is **cute → majestic** — small
  stages are round mascot creatures, the top stage is a grand bonfire. NOT
  aggressive (reviewed mochi `pet_art.py`; the user kept this direction).
- DECIDED: keep mochi's **parts grammar** verbatim so art stays
  name-deterministic and identity-preserving across growth (`partsForName`,
  `render`, `canonStage`, `HUE_COLOR` unchanged).
- PROVISIONAL: the frame glyphs below (this is an art spec, expect tuning).
- Cross-refs: bonded fire is pinned to `emberling` (the mascot); non-bonded
  fires take a name-seeded stage across the full `spark→fire` range; ignis
  currently surfaces only **idle** (alive) and **dead** (snuffed) — happy /
  eating / sleeping are authored here for completeness but stay **dormant**
  until reactions/statuses land (DESIGN.skills, TBD).

---

## 1. The grammar (inherited from mochi — do not change)

Every Cinder is composed from gacha **parts**, rolled deterministically from
its name (`partsForName` → seeded `rollParts`):

| Part | Role in the frame |
|---|---|
| `core` | the **eyes** glyph — the fire's identity; idle blinks `core → .` on alternate frames |
| `flame` | the **tip** style — swaps the crown rows via `tip(style, level)` (plain `^` / crown `/\` / curl `~)` / split `\_/` / tall `/\|\` / wide `~~~` / triple `^^^` / halo `(o)` / double / + the §4-era styles fork/twist/plume/spire) |
| `sparks` | drifting particles above the flame; `sparkPhase` rotates them per variant |
| `aura` | an outer glow ring, rare+ only; overlays the base row |
| `hue` | colour only (`HUE_COLOR`), never a glyph |

Frame contract (unchanged): **12 rows × 20 cols**, every row `rowC`-centred
and space-padded; `render(stage, parts)` returns `{ mood → Frame[] }`;
`MOOD_FRAME_COUNT` = idle 6 / happy 6 / eating 4 / sleeping 2 / dead 3 (ignis
values — keep as in `petart.ts`). The `dead` mood is the shared smoke frame
for every stage.

The four growth stages and their visible-row budget (the scale ramp *is* the
cute→majestic story; everything else is parts):

| Stage | Read | ~visible rows |
|---|---|---|
| `spark` | a shy flicker with a face | ~4 |
| `emberling` | the mascot — round face in a flame collar, glowing feet | ~7 |
| `ember` | a standing flame-creature, stubby limbs | ~9 |
| `fire` | a full bonfire — tall crown, broad logs | ~12 |

---

## 2. The idle lineup (APPROVED direction)

`o` = the `core` (identity eyes). These are the centred motifs; the real
frames are the full 12×20 grid with these blocks vertically centred low→high
as the stage grows.

### spark — a shy flicker
```
       '
       ^
     ( o.o )
      `-_-'
```

### emberling — the mascot (bonded fire's pinned stage)
```
        )
      ,'^'.
     ( o _ o )
      \ ._. /
       `|||`
      .=====.
```

### ember — a standing flame-creature
```
        ^
       /^\
     ,-'''-,
    ( o   o )
     \  _  /
      )/ \(
      /|_|\
     [=====]
```

### fire — a majestic bonfire
```
      \ * /
       \|/
    \\ ||| //
     \|||||/
    __|||||__
   [===|||===]
  [============]
  [____________]
```

---

## 3. Mood deltas (per stage, same parts)

The face is `( <eye> <mouth> <eye> )` with the stage's flame/body around it.
Mood only changes the eye/mouth glyphs and the top decoration (mochi-faithful):

| Mood | eyes | mouth | extra | ignis status |
|---|---|---|---|---|
| `idle` | `core` → `.` (blink) | `_` | sparks drift | **LIVE** (alive) |
| `dead` | — | — | shared smoke-over-embers frame, 3-phase rise | **LIVE** (snuffed) |
| `happy` | `^` / `*` (twinkle) | `v` / `U` (smile) | sparks burst | dormant (TBD) |
| `eating` | `O` / `o` (blink) | `w` / `u` (chew) | `. + .` crumbs | dormant (TBD) |
| `sleeping` | `-` / `_` (lids) | `_` | `z Z z` rising, body folded smaller | dormant (TBD) |

`dead` (all stages, verbatim from mochi — keep):
```
  '  .  '
   ~ ~
  ~ . ~
 '  ~  '
 . + . + .
  +  +  +
  =======
 /       \
=========
```

Tip substitution: each stage builds its crown from `tip(flame, level)` — spark
uses level 1, emberling 1, ember 1–2, fire 2–3 — so a `curl`-flame fire reads
distinctly from a `crown`-flame fire while sharing the silhouette. Do not
hardcode `^`; always route the crown rows through `tip`.

---

## 4. Implementation notes (when built — design only for now)

- Replace only the per-stage builders (`sparkFrame` / `emberlingFrame` /
  `emberFrame` / `fireFrame`) and `smokeFrame` in `src/core/petart.ts` with
  the motifs above, keeping signatures `(mood, core, flame, sparks, aura,
  variant) → Frame`.
- Leave intact: `rollParts` / `partsForName` (identity), `render`,
  `HUE_COLOR`, `Stage`/`Mood` types, `canonStage` (bonded→emberling,
  non-bonded→name-seeded), `cinderFramesStable`, the felt firewall. No new
  fields, no signature changes.
- Tests (`src/core/petart.test.ts`): the existing invariants must still pass —
  every frame exactly 12 rows × 20 chars; `dead[0]` contains the charred base
  (`=====`); `partsForName` stable per name; full stage range occurs across
  names; `canonStage` bonded = `emberling`. Add a per-stage golden-row check
  if the motifs are locked.
- Determinism unaffected (parts are name-seeded; no rng added).

## 5. OPEN

- O-A: exact glyphs for the dormant moods at `ember`/`fire` (only idle+dead
  ship now; happy/eating/sleeping authored when reactions land).
- O-B: whether `fire` ever shows a face (currently faceless/architectural per
  the majestic direction) — revisit only if evolution adds a "fierce" read.
- O-C: lock motifs as golden test rows, or keep PROVISIONAL for art tuning.
