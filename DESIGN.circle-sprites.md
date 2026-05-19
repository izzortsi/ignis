# Fix: stale / badly-wired Cinder sprites in the camp "circle" roster

Status: plan (investigation complete). Companion to `DESIGN.ascii.md`.
Markers: DECIDED / PROVISIONAL / OPEN.

## Context

The ASCII Cinder sprites in the camp **circle** tab look stale/wrong. The
battle path was fixed earlier (`BattleEncounter.CinderSprite`) to render from
the *live* Cinder; the camp `FireSprite` never got the same treatment.

## Root cause (grounded, file:line)

`src/ui/map/CampScene.tsx` `FireSprite` (~L425-435) is passed only a **name**
(circle `<For>` ~L526-539 passes `name={c.name} bonded={i()===0}`, not the
real `c`). It rebuilds a throwaway Cinder every render:

```
const c = kindle(p.name, p.bonded ?? false);   // fresh stand-in
const frames = cinderFramesStable(c);           // const, computed once
... frames[fireTick() % frames.length] ...
```

`kindle` (`src/core/cinder.ts`) resets `vitality=VIT_START(0.7)`, `level=1`,
`bond=0`, `streak=0`, `skills=[]`. So vs. the real `props.run.circle[i]`:

1. **Snuffed fires still look alive.** `cinderFramesStable` →
   `cinderMoodStable(isAlive(c))` (`petart.ts`); `isAlive` is `vitality>0`.
   A staked/snuffed circle fire (`vitality===0`) re-kindles to `0.7` → always
   the `idle` frames, never the smoke/`dead` frame. (Wrong mood.)
2. **No live state.** Level/bond/streak/skills are gone — anything visual that
   should ever reflect them can't (today only mood differs, but the wiring is
   structurally wrong and will keep drifting).
3. **Not reactive.** `frames` is a `const` captured at create time. The circle
   `<For>` re-runs on `rosterBeat()` (recruit/release) so it *recreates*
   FireSprite then — but a fire that dies/levels mid-visit (or any future
   state-driven art) won't update; only `fireTick()` (the frame index) is
   reactive, animating a frozen stage/mood.

`canonStage(c)` (`petart.ts`) = `c.bonded ? "emberling" : stageForName(name)`.
With the `bonded` flag now passed this is *correct for circle[0]*; the real
defect is mood/liveness + the non-reactive `const`, not the stage.

Correct reference pattern — `BattleEncounter.CinderSprite`
(`src/ui/encounter/BattleEncounter.tsx:171-187`): takes a **reactive accessor
to the real object** (`p.c: () => Combatant`), and `parts`/`mood`/`frames` are
**functions** (re-evaluated, tracked), so it always reflects the live Cinder.

## Fix (DECIDED — mirror the battle pattern; reuse existing core)

No core changes. `cinderFramesStable(c: Cinder)` already does
canonStage+mood+`isAlive` correctly **when handed the real Cinder** — the bug
is purely that FireSprite isn't handed it.

`src/ui/map/CampScene.tsx` only:

1. **`FireSprite` takes the real Cinder via a reactive accessor**, like
   `CinderSprite`:
   ```
   function FireSprite(p: { c: () => Cinder }) {
     const parts  = () => partsForName(p.c().name);
     const frames = () => cinderFramesStable(p.c());     // live stage+mood
     const col    = () => "#" + ((HUE_COLOR[parts().hue] ?? 0xffaa44) >>> 0)
                              .toString(16).padStart(6, "0");
     return <pre class="camp-fire-art" style={{ color: col() }}>
       {(() => { const f = frames(); return f[fireTick() % f.length].join("\n"); })()}
     </pre>;
   }
   ```
   (`fireTick()` read inside the render keeps the animation; `frames()` reads
   the live Cinder so mood/stage are correct and update.)
2. **Circle `<For>` passes the real object**, reactively:
   `<FireSprite c={() => (rosterBeat(), props.run.circle[i()])} />`
   — circle[0] is `bonded:true` → `canonStage` → `emberling`; a snuffed fire
   → `isAlive` false → smoke `dead` frame; no stand-in.
3. **Stable tab** (`props.run.meta.caught` are `{name,stage}` records, NOT
   Cinders — there is no live fire): keep a name-preview, but build it once
   (not per render) — `const preview = kindle(e.name, false)` inside the
   `<For>` row callback, pass `c={() => preview}`. Caught previews are
   correctly non-bonded/alive. (DECIDED: stable stays a name-preview;
   only the circle was "stale".)
4. Remove the now-unused `bonded?` prop path; `kindle` import stays (used by
   the stable preview).

## Critical files

- `src/ui/map/CampScene.tsx` — `FireSprite` signature/body; circle `<For>`
  (~L526) and stable `<For>` (~L548) call sites. Only file changed.
- Reference (unchanged): `src/ui/encounter/BattleEncounter.tsx:171-187`
  (`CinderSprite` pattern).
- Reused unchanged: `cinderFramesStable`/`canonStage`/`cinderMoodStable`/
  `partsForName`/`isAlive` (`src/core/petart.ts`, `src/core/cinder.ts`).

## Verification

- `cd /workspace/ignis && npx vitest run` — full suite green (pure core
  untouched; this is UI-only, so the headless tests are unaffected and serve
  as a no-regression check).
- Logic spot-check (read-only, `npx tsx`): `cinderFramesStable` on a real
  bonded fire → `emberling` idle frames; on a `vitality=0` fire → the smoke
  `dead` frame (the exact thing the stand-in suppressed).
- UNVERIFIED by build (Solid won't compile here — §11 deps): the
  `CampScene.tsx` JSX/accessor rewrite ships unverified; manual `npm run dev`
  pass — open camp → circle tab: the bonded fire is the emberling mascot, a
  recruited fire shows its own name-seeded sprite, a snuffed fire shows smoke;
  sprites animate; recruit/release still updates the list.

## OPEN

- O-A: per-fire animation phase (all camp fires share `fireTick` → same
  phase). Cosmetic, out of scope; flag only.
