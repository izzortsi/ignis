# Ludus Ignis (game)

A roguelite creature-collector with tamagotchi care, set in the Ludus Ignis world.
This repo is **game-first**; it shares only the lore with `/workspace/ludus-ignis`
(which was a teaching tool — that mission is dropped here, see `DESIGN.md` §0).

- Design: [`DESIGN.md`](./DESIGN.md) — decisions use the bible's DECIDED/PROVISIONAL/OPEN/LIBERTY markers.
- Lore source of truth: [`lore/timeline.md`](./lore/timeline.md) (iteration 7 — teaching mission excised). The original tutor bible at `/workspace/ludus-ignis/lore/timeline.md` is untouched.

## Stack

TypeScript + Vite + Canvas 2D ASCII, vanilla (no framework). Deterministic seeded
runs (splitmix64 BigInt RNG). Node 20+.

```
npm install
npm run dev      # dev server
npm test         # vitest (headless)
npm run build    # tsc --noEmit + vite build
```

## Status

Scaffold only: deterministic RNG (tested), ASCII screen, scene loop, persistence,
a placeholder title scene. Reading engine, Cinder model, run structure, the two
battle modes, and the dex are the next phases (see `DESIGN.md` §12).
