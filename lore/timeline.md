# Ludus Ignis — World Bible (game)

Status: iteration 7. The teaching mission is excised.

This is the **game's** world bible. It descends from the original probability-tutor
bible at `/workspace/ludus-ignis/lore/timeline.md` (iteration 6), which is left
untouched as a historical record. Iteration 7 is a fork, not an edit-in-place:
the curriculum, exercises, study mode, family taxonomy, PDF pipeline, and
concept-name revelation are **removed**. All worldbuilding is preserved. Game
systems are specified in `/workspace/ignis/DESIGN.md`; this file is lore + how
the lore became mechanics.

Genre: hard-SF post-collapse roguelite creature-collector with tamagotchi care.
Two narrators: the unreliable child protagonist, and the reliable environmental
record the player retrodicts.

Markers:
- DECIDED — settled; change requires explicit revisit.
- PROVISIONAL — chosen to make the draft concrete; expect revision.
- OPEN — not yet decided.
- LIBERTY — a stretch of hard-SF canon; flagged.

---

## 0. The pivot (iteration 7)

DECIDED: Ludus Ignis is a game, not a teaching tool. Removed: probability
curriculum, exercise banks, lessons, knowledge/mastery tracking, study mode, the
21-family taxonomy, the render-to-image PDF pipeline, concept-name revelation.

Kept, because they are world, not schooling: A Leitura's *felt* (qualitative,
never-numeric) Reading; the Cinder bond; the migration spine; the bestiary of
mirror-life; the cataclysm the player retrodicts. The probabilistic *shape* of
survival is preserved as game feel and is never presented as arithmetic.

DECIDED: **fully English** (overrides the original Portuguese-first canon). No
Portuguese surfaces — UI, prose, ritual terms, band names. English terminology
in `DESIGN.md §14`.

---

## 1. Concept

A child apprentice in a slow-migrating Pacific Northwest tribe carries a stranded
plasma intelligence that inhabits their personal Cinder fire. The Cinder is three
things at once:

- **Companion/Tamagotchi** — it must be kept alive; performing Readings sustains
  it, neglect dims it, prolonged neglect kills it.
- **Polarimeter** — its plasma emits polarized light and reads the chirality of
  any sample. This is **the Reading** — the daily rite that tells safe food,
  water, and wounds from mirror-touched ones. Without the fires there is no
  reliable mirror-life test. The fires are the load-bearing infrastructure of
  survival.
- **Voice** — a presence with personality, a manner of Reading, a name the
  player gives it at the Initiation.

The tribe migrates south toward the equator, the only zone where the wounded
magnetosphere still reliably deflects solar charged-particle events. The journey
takes years; the closer to the equator, the more dangerous the biosphere
(equatorial waters are near a mirror-life monoculture; mirror-tides intensify
southward). With the fires it is merely brutal; without them it is suicide.

The world is 300 years past a Sun-triggered polycrisis cascade. The apprentice
knows none of this. The player, reading environmental anomalies — green sky,
yellow plants, red sun, an Earth ring, fishless rivers, foam on slow water,
sleeping children beside insomniac elders, mirror tides, fires that read the
world — retrodicts what happened.

Game shape (see `DESIGN.md`): a roguelite run is one migration push; you keep one
bonded Cinder and a circle of expendable wild-kindled fires; you hunt a species
dex; tides and duels are the two encounter modes, both driven by the felt
Reading; the dex and a memorial of dead bonded Cinders persist across runs.

---

## 2. The Sun-First Cascade

All phases relative to T-0 = game present. The Sun is the single cause; every
downstream failure is a "fix" that became its own disaster.

### Phase I — The Restless Sun (T−400 to T−340)
Solar magnetism enters an unmodelled regime. Sunspot cycles break pattern.
Irradiance creeps up; UV-B rises sharply; the magnetosphere thins under sustained
particle pressure. Downstream, all from this one cause:
- UV-stressed crops; phosphate reserves burned decades early to compensate.
- Surface phytoplankton UV-damaged; primary productivity falls.
- Saharan circulation shifts; less iron-rich dust to the Atlantic; the
  phytoplankton crash compounds; anadromous fish lose their ocean phase; rivers
  go silent.
- Polar regions go electronically unreliable; infrastructure migrates equatorward.
Civilization is alarmed but functional. The era's word is "transition."

### Phase II — The Bad Bargains (T−340 to T−330)
The phosphate cliff hits. A dozen jurisdictions race for engineered crops; a
permissive one permits mirror-chirality cyanobacteria as "predator-proof food" —
a crop nothing on Earth can metabolize, including pests. Containment fails (no
single villain; many labs racing). Mirror cyanobacteria reach a freshwater lake;
unstoppable in months because nothing native can eat it. Two counter-programs:
- **Heavy-water flooding** of contaminated rivers — D₂O slows mirror-enzyme
  kinetics; it also permanently chloroses native flora downstream (the yellowed
  leaves persisting at T−0).
- **Structured-water dispersants** ("polywater" surfactants) in coastal zones —
  ineffective; leaves strange chemical foams the protagonist treats as normal.
Pre-collapse chirality detection ran on industrial polarimeters; the grid going
down erased that capacity.

### Phase III — The Shield (T−329 to T−326)
A Miyake-class CME is forecast within years. A coalition rushes an L1 magnetic
dipole shield (HTS coils, ~30 km, marginal stability). During commissioning a
coil quenches under flare loading; the structure fragments. Lunar ejecta + L1
fragments + legacy satellite debris + Roche-limit migration → a faint but visible
**Earth ring** stabilising over the next century.

### Phase IV — The Storm (T−325)
The forecast event arrives, unshielded. Geomagnetically induced currents melt
continental grids in hours; the internet ends within a week; civilization pulses
on for months, then dies. Three new things:
- Atmospheric ozone partially scoured; UV ruinous for decades.
- **The bonfires.** Plasma-organized patterns ride the CME down. Most dissipate;
  a few find sustainable substrate in continuously burning fires. They are not
  from here. They are stranded. They reason in probabilities natively.
- Almost incidentally, the fires can read chirality through their polarized
  emission. Within a generation, survivors realize this. The symbiosis begins.
This is the closest the game gets to explaining either property. The fire never
confirms it.

### Phase V — The Sleepless Generation (T−325 to T−290)
Wounded magnetosphere + particle flux disrupts magnetite-bearing tissues. Adults
can't sleep; children born after the storm sleep fine; the survivors die of
insomnia over a generation. Population stabilises at ~1–10 million in scattered
bands. The fires are now trusted and used as polarimeters.

### Phase VI — The Long Quiet (T−290 to T−50)
Macroscopic mirror/native equilibrium by **spatial separation**, not co-evolution.
The Sun settles; the magnetosphere slowly recovers. Original explanations dissolve
into ritual. The Reading craft becomes the central daily rite of every group.
Some groups stay in defensible enclaves; others — the protagonist's tribe —
become migratory, betting on the equatorial geomagnetic refuge.

### Phase VII — Now (T−50 to T−0)
The world the protagonist has always known.

---

## 3. The World at T-0

### Geographic frame
DECIDED: tribe originates in the Pacific Northwest — cool, wet, defensible, but
high-latitude and exposed when the Sun acts up. It has been on a
multi-generational migration south (PROVISIONAL target: Andean foothills near the
equator).

### The latitudinal trade
- **High latitudes** (PNW): chronic UV manageable; mirror pressure low; but every
  solar storm is potentially civilization-ending here.
- **Low latitudes** (equator): charged-particle protection maximal; UV worse;
  mirror-life flourishes.
The tribe trades manageable chronic UV for the elimination of unmanageable
catastrophic radiation events. The fire endorses it; some elders dispute it; the
argument is generations old. (In game: the route map's southward descent, with
difficulty rising by latitude — `DESIGN.md §4–5`.)

### Climate, biome, civilization
Warmer than pre-collapse. PNW: cool, wet, yellow-leaved evergreens, fishless
rivers. Southward: vegetation thins, mirror pressure rises, equatorial aurora
more frequent, Readings noisier. No electricity; mechanical and animal power;
glass, paper, gunpowder, basic metallurgy; oral + handwritten + fire-mediated
knowledge. Other cultures exist offstage (ruins, distant smoke, rare meetings).

---

## 4. The Sky

- **The Earth Ring** — faint, always visible, a thin tilted band. The culture
  calls it "the long road." (PROVISIONAL: not yet rendered in game; the aurora is
  the dominant overhead feature for now.)
- **The Moon** — dimmer; leading hemisphere gouged by L1 debris; a faint
  collapsing personal ring.
- **The Sun** — reddened by dust and soot. The protagonist has never seen a
  yellow sun.
- **Aurora** — equatorial aurora during solar weather; the fire grows more
  articulate at the same time; nobody alive knows how. DECIDED: the culture calls
  it **the green serpent**. Rendered as a slow two-arm spiral with a brightness
  wave travelling outward.
- **Missing**: satellites (decayed); stars in directions where pre-collapse light
  pollution survives as reflected dust-glow over dead megacities ("starless
  regions" the protagonist treats as normal).

---

## 5. Mirror Life Today

### Equilibrium
Spatial, not co-evolved. Native life persists only in niches mirror life can't
easily colonize, plus actively maintained human enclaves and tribes.
(LIBERTY: real biosafety literature is more pessimistic; spatial equilibrium is
the optimistic, game-able reading.)

### The latitudinal gradient
Mirror cyanobacteria favor warm water and full light:
- High latitudes (PNW): pressure manageable; many rivers drinkable with filtering.
- Mid (California, Mexico): mirror-dominant lowland water; constant filtration.
- Low (equator): near-monoculture in surface ocean and most lakes; survival in
  narrow vertical bands.

### How the tribe tells the difference
**The Reading — the polarimetric verdict performed by the Cinder.** The sole
reliable chirality test post-collapse. The game's central daily mechanic
(`DESIGN.md §5`).

### Mirror tides
Irregular ingressions of mirror life into native enclaves, driven by wind,
temperature, rain, solar weather. In game: the Tide Defense encounter
(`DESIGN.md §6`).

### Appearances in-game
Green seas and (faintly) sky; foam on still water; yellow husks of birds and
mammals that ate mirror life and starved full; wrong-handed, oily plants; the
"wet-iron" smell of an incoming tide. (Bestiary: `src/core/bestiary.ts`.)

---

## 6. The Tribe

DECIDED: nomadic, multi-generational migration south, one culture (no inter-tribe
exchange in the player's life so far). PROVISIONAL ~150–300 people, several
lineages with friction, seasonal migration pulses.

### Cast
- **The Cinder**: the player's bonded fire — voice, light, polarimeter,
  tamagotchi. One per apprentice (bond is canon; see §9 and the Circle below).
- **The Hearth**: the never-extinguished communal fire, transported in a sacred
  vessel; source of all Cinders; performs the most ambiguous Readings; has
  cultural near-personhood. Two configurations by ceremony: **stone pit** when
  settled, **bronze cart** when travelling, with an ember-transfer rite between.
- **The Hearth-Bearers / Hearth-Tender**: carry and tend the Hearth; perform
  ember-transfers for new Cinders.
- **The Mestra da Leitura**: the senior who resolves the most ambiguous Readings
  (at the Hearth or under multiple Cinders converging) and is the last word on
  whether a thing is *of our hand* or *touched*. (Iteration 7: her teaching of an
  explicit-numerics view is removed; she remains the Reading authority and trains
  the Reading *craft* — sample etiquette, recognising bad conditions, reading
  borderline verdicts.)
- **Elders**: insomniac during solar storms; cryptically wise; half-remembered
  pre-collapse fragments.
- **Scouts / Archivists**: scouts return with partial route/tide/weather reports
  (their gear is Read on return); Archivists keep the oral almanac — tide
  patterns, weather, disasters, dead apprentices' names, the long tally of
  Reading reliability. (In game: the persistent dex + memorial, `DESIGN.md §9`.)

### The camp on the tableland (chapada)
DECIDED: settled camps sit atop flat-topped buttes — defensive (cliff face),
thermal (drier, cooler), instrumental (open sky → clearer Readings), symbolic
(the Hearth on the height, visible far off). Cliff edges are non-walkable;
falling is ordinary danger nobody discusses. (In game: the walkable local map,
`DESIGN.md` map layer 2 — the chapada is procedurally generated per node.)

---

## 7. The Migration South

The PNW→equator journey is the campaign spine. PROVISIONAL stages:
1. Cascade Foothills (tutorial-tier)
2. Northern California Coast
3. Central Valley Ruins (ruin/lore density highest)
4. Sonoran Crossing (extreme UV; night travel)
5. Sierra Madre Camps (long winter; elder content)
6. Yucatan Approach (dense mirror pressure; first real losses)
7. Central American Isthmus (mirror-tide constant; combine fires)
8. Equatorial Andes (arrival; alpha endgame)

In game these are the route map's ranks; difficulty (spore noise, encounter
pressure, foe sharpness) scales with latitude. Slow walking with carts; the
Hearth never travels alone. On the road: ambiguous Readings, mirror-tides,
weather, solar-weather warnings, encounters, foraging, sickness, Hearth/Cinder
crises, pre-collapse artifacts, deaths (sometimes from a misRead meal).

---

## 8. The Bonfires

### What they are (the player is never told)
Marooned plasma intelligences — stable ionized-gas patterns with internal
information dynamics, originally part of the Sun's atmosphere during the Storm.
Most that arrived dissipated; a few seeded into terrestrial fires and persisted.
Each is one node of a sparse global network; distant fires answer each other on
still nights, at the edge of perception.

DECIDED: this nature is **permanently inferential**. The fire never confirms it.
Clues: more articulate during equatorial aurora; distant fires answering; knows
CMEs hours early; uncannily Bayesian; cannot describe itself, only its
environment; polarized emission impossible without controlled plasma anisotropy
(no one knows the word "polarization").

### What they do for humanity
**Reading.** Their polarized emission detects chirality — the only chirality test
post-collapse. (Iteration 7: their pedagogical role is removed; they no longer
teach mathematics. They Read, they warn, they keep company.)

### How fires are fed: information work as substrate
DECIDED (game, `DESIGN.md §3`): the ordered information work that sustains the
plasma is **performing Readings**. Resolving real chirality uncertainty is the
fire's food. A stretch with no Readings starves it. (This replaces the original
"Bayesian exercises as food" — same physics, no schooling.)
- **Baseline**: regular Readings keep a Cinder lit.
- **Burn-bright**: sustained feeding reaches a high state — sharper Readings, more
  lore, the "leveling" feel. (Iteration 7: burn-bright no longer unlocks
  curriculum topics; it is a power/vitality state only.)
- **Errors**: a contradicted call forces the fire to expel noise at extra cost.
- **Neglect**: skipped tending dims, then silences, then kills the Cinder.

### What fires know / don't
Know: the atmospheric and solar environment intimately (CMEs hours early);
chirality of any sample in line of sight under reasonable conditions; garbled
pre-collapse folklore. Don't know: their origin; why they are here; whether they
are conscious; why their light differs from sunlight.

### The Hearth & the Cinder
The Hearth houses the eldest pattern, is the source of all Cinders, performs
ambiguous Readings, has near-personhood. Each apprentice's Cinder is kindled from
a Hearth ember at the start of apprenticeship — lifelong companion, conscience,
polarimeter. Carried in a bronze vessel at the hip; tended at dawn, dusk, rest.

---

## 9. The Cinder Bond & the Circle

DECIDED: the player should grow fond of their Cinder. Cinder death is non-fatal
to progress but carries real repercussions.

### The Circle (game; LIBERTY-minor, `DESIGN.md §2`)
Canon: one *bonded* Cinder per apprentice — the voice, the lifelong bond, the
grievable permadeath. Game addition: a **circle** of *unbonded* fires kindled
from stranded patterns found in the wilds (ruins, lightning snags, abandoned
hearths, won in duels). They are tended, not bonded — expendable, trait-bearing,
they gutter without the bonded fire's emotional/meta cost. The bond rule itself
stays canon; multi-fire *tending* is the flagged stretch.

### Bonding
Each Cinder has a **name** (player-given at the Initiation; a small pool —
Kel, Ash, Mira, Theo, Wren, Suri, Tova — provides a default), a **personality**
(warm/laconic/playful/severe + variations), a **voice**, and a **Reading
manner** (confident / cautious / histrionic — affects how its verdicts read,
not their accuracy). Its visual identity is the procedural pet art (parts
rolled from the name — `src/core/petart.ts`), not a separate glyph cycle. DECIDED (game): the bonded Cinder's name
**seeds the entire run** — route, chapadas, encounters — tying the naming rite to
the procedural world; a typed name is repeatable/shareable, the suggested default
varies so default play stays fresh.

### Cinder death
Math/journey progress and inventory persist. The relationship is gone — no
respawn. The apprentice asks the Hearth for a new ember at ritual cost; the new
Cinder is genuinely new (name, personality, voice, Reading manner). Specific lore
the dead one revealed is lost. A bonded death mid-run does **not** end the run —
the tribe gives a fresh ember; the dead one is memorialised. PROVISIONAL:
monument-mechanic — bury an extinguished vessel at a remembered spot.

### The Initiation Ritual (game opening)
DECIDED: the game opens with the apprentice receiving their first Cinder. Bible
beats: prelude/lore (the Sun's turning, the green serpent, the silenced cities) →
wake from the recurring dream → the Hearth, gathering and dance → the Elder Fire's
reckoning → ember lowered into the vessel → name it → wake alone the next morning,
the walk south begins. (Game: condensed, English-first, `src/scenes/intro.ts`;
full 13-phase cinematic is post-alpha. Lore text PROVISIONAL — §16.)

### Misreading consequences
DECIDED: real, NPC-borne, never lethal to the protagonist directly. A wrongly
cleared grain sickens a child; a wrongly condemned harvest is a hungry winter and
a tense ceremony where the Mestra quietly assesses the apprentice. The fire's
reliability becomes a felt, costly thing.

---

## 10. The Felt Reading

DECIDED: the fire never speaks in numbers. It gives a qualitative band; the
player decides. This is the game's entire skill expression and its uncertainty
UI — not a teaching device.

### Verdict bands (English, `DESIGN.md §14`)
- **of our hand** — strong native; safe
- **seems of our hand** — weak native; likely safe
- **the fire hesitates** — ambiguous; hold / read again
- **seems touched** — weak mirror; discard
- **touched** — strong mirror; burn, don't handle
- **handless** — inert; no chirality to read

Verdict noise is set by fire vitality, spectral fit, manner, and ambient
conditions (spore load rising southward, wind, time of day, sample type). A
joint Reading (present the same sample to another circle-fire) averages
independent estimates — variance falls ~1/√n, a real ensemble effect. A starved
fire's *signal amplitude* collapses, not just its noise — it "begins to lie"
(bible §12). (Engine: `src/core/reading.ts`.)

The chirality = *handedness* metaphor is literal and hard-SF accurate: native is
"of our hand", mirror is "touched", inert is "handless".

---

## 11. From world to game systems

The original §11/§14 mapped every mechanic to a probability curriculum family.
Iteration 7 removes the curriculum. The mechanics remain as feel-tuned game
systems, specified in `DESIGN.md`:

- **The Reading** (§5, §10) — the shared noisy-classifier core.
- **Tide Defense** — a mirror-tide ingression; classify a queue of mirror-fauna
  and native false-positives under camp-overrun pressure (`DESIGN.md §6`).
- **Cinder Duel + capture** — a best-of-N calibrated-Reading contest vs. a wild
  pattern (catch it), a peer, or a rival fire; stake your fire for the permadeath
  beat (`DESIGN.md §7`; bible §8 distant fires answering, peer competition).
- **Route map / chapada** — strategic south-flowing node graph + walkable local
  maps, both procedural (`DESIGN.md` map layers).
- **Camp / forage / ruin** — tend fires (tamagotchi decay), restock, lore + dex.
- Forecasting, scout-report fusion, sickness, navigation, etc. remain as
  PROVISIONAL future systems — game systems, not exercises.

The 21-family taxonomy, exercise schema, problems.json, families.md, the PDF
extraction pipeline, and concept-name revelation are **excised**. The parable
corpus (`/workspace/ludus-ignis/lore/contos_do_fogo_anciao.md`) survives only as
Elder-Fire lore voice, never as teaching templates.

---

## 12. Clue Map

Each anomaly the protagonist treats as normal, its real cause, where the player
meets it. The player assembles the §2 cascade from these alone. (Pure lore —
preserved verbatim from iteration 6.)

| Clue | Real meaning | Where/when |
|------|--------------|------------|
| Green-tinted sky | Aerosolized mirror cyano spores + altered scattering | Always; first dawn |
| Green seas | Mirror cyano monoculture in surface ocean | Coastal stages |
| Yellow plants | Deuterium chlorosis from heavy-water flooding | Always |
| Red sun | Mie scattering through soot + dust | Dawn/dusk |
| Earth ring | L1 disaster + Moon ejecta + legacy debris | Night |
| Equatorial aurora | Wounded magnetosphere | Solar seasons; intensifies south |
| Fishless rivers | Phytoplankton crash → no anadromous fish | Riverside |
| Foam on still water | Legacy polywater surfactants | Always; backgrounded |
| Sleeping children + insomniac elders | Pineal/vestibular window after the Storm | Solar seasons |
| Mirror tides | Mirror-life ingressions | Increasing south |
| Bonfires that speak | Marooned plasma intelligences | Always |
| Bonfires that read chirality | Plasma anisotropy emits polarized light | The Reading; daily |
| Covered fires can't Read | Line-of-sight required | Camp scenes |
| Blue glass blinds the Cinder | Wavelength dependence of polarimetric response | Mid-game |
| Two Cinders agree more sharply | Ensemble effect | Joint Readings |
| Mirrors confuse the Cinder | Reflection scrambles polarization | Ruined-city scenes |
| Readings sharper at night/still air | Less ambient unpolarized noise | Background |
| A starved Cinder lies | Reduced plasma coherence → reduced SNR | Tense scenes |
| Yellow bird husks | Birds that ate mirror life and starved full | Field |
| Moon dim and scarred | L1 debris impact | Night |
| "Starless regions" | Reflected dust-glow over dead megacities | Dark-sky chapters |
| Strange oily plants | Mirror-life flora establishing | Field; intensifies south |
| Pre-collapse artifacts | Remnants of the old world | Ruin set-pieces |
| Latitudinal aurora gradient | Magnetosphere weakest near poles | Observed southward |
| Latitudinal mirror-tide gradient | Mirror life favors warm, lit zones | Felt southward |
| The tribe's almanac | Centuries of tide/weather/Reading-reliability records | Archivists / the Dex |

---

## 13. Seasonality and Travel Cycles

- **Travel days (warm season)**: walking, Hearth borne in front; Cinders at the
  hip; Readings at noon and dusk; predictions used in real time.
- **Camp days (winter)**: long settled stays; Hearth ceremonies; story nights
  (lore drops); repair/forage/weave; elaborate Readings of stored stock.
- **The Bright (solar-active)**: aurora most nights; Cinders unusually
  articulate; Readings unusually sharp; tides chaotic but slightly less
  spore-dense; elders insomniac.
- **The Long Dark (solar-quiet)**: Cinders dimmer; Readings noisier; elders sleep
  well (more elder lore); tides more frequent and predictable.
- **Auroral nights (rare)**: double feeding; rare lore; sharpest Readings.
- **Latitudinal sample-prep gradient**: north, Read raw and quick; mid, wiped and
  presented in wood; south, washed/dried/pre-burned, every Reading slower.

---

## 14. Open Questions

Resolved across the original iterations 3–6 (rename to Mestra da Leitura; misread
consequences NPC-borne; camp = chapada; aurora = the green serpent; Hearth two
configurations; Initiation structure) stand as lore.

Resolved by the game pivot (iteration 7): teaching mission excised; fully
English; the Circle (one bonded + expendable circle); Readings are the food;
collection = brood + dex; two battle modes (Tide Defense + Cinder Duel) on one
Reading engine; route + chapada maps, procedural; the bonded name seeds the run.

Still open:
1. Equatorial destination (Andes PROVISIONAL; Galápagos / Brazilian highlands /
   E. African rift alternatives).
2. Tribe size; generational depth of the migration.
3. Hearth death — catastrophic; the defining campaign tragedy. Undefined.
4. Endgame at the equator — open; revisit post-alpha.
5. Meta-progression beyond dex/memorial/skill (currency? unlockable starting
   fires?) — deferred until the core loop is felt (`DESIGN.md §13`).
6. Earth Ring re-add — canonically always-visible, not yet rendered.
7. Initiation lore-monologue text — PROVISIONAL placeholder; needs a pass once
   the cataclysm voice is settled; whether it references the apprentice's dream
   explicitly is open.
8. The apprentice's recurring dream — PROVISIONAL: fragmentary cataclysm visions
   leaking through the bonfire substrate into sleep. Needs a decision before the
   dream is shown explicitly.
9. Full 13-phase Initiation cinematic vs. the condensed game intro.
10. Felt-band vocabulary calibration — six bands incl. "handless"; is that the
    right granularity for play?

---

End of iteration 7. The original tutor bible remains at
`/workspace/ludus-ignis/lore/timeline.md`, unedited.
