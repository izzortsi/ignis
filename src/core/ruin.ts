// A glassed-ruin (`?`) site: a seeded mixed table — deterministic per site, so
// re-entering a leg yields the same find and different ruins differ. Pure
// logic; the cave scene applies the side effects (recover a memory, log a
// relic into the dex, restock provisions, or spring a rubble-pool wild).
//
// Bands (a single roll): memory .30 · relic .25 · cache .25 · wild .20.
// When no flashback is left to recover, the memory band falls back to a relic.

import { Rng, seedFrom } from "../rng";

export type RuinKind = "memory" | "relic" | "cache" | "wild";

export interface RuinRoll {
  kind: RuinKind;
  relicSpecies: string; // meaningful only for "relic" (also surfaces as relicName)
  provisions: number; // LEGACY (B2.1 bridge) — signed float, ignored by B2.2+ callers
  // B2.2 inventory fields. Callers apply these directly via inventory.ts
  // helpers rather than the legacy `provisions` bridge in applySpoils.
  caches: number; // generic cache item count to add to run inventory
  restoratives: number; // vitality restorative count (bonus drop on cache/relic)
  relicName: string; // non-empty on relic band — push to meta.relics
  xp: number; // XP grant for the fielded fire (memory/relic/cache; wild gets XP from the battle)
  message: string; // the felt line shown in the cave (no numbers)
}

// Pre-collapse relics — inert (handless) lore, varied so the dex grows.
const RELICS: string[] = [
  "a cracked solar lens",
  "a dead drone's shell",
  "a server's glass core",
  "a mirror-lab seal",
  "a ration tin, long empty",
  "a child's melted toy",
  "a sun-bleached road sign",
  "pre-collapse relic",
];

// XP scaled lightly by latitude: a Cascade ruin pays a small amount, an
// Andes ruin meaningfully more. Caller passes lat 0..1 (stageIndex/7).
// Memory band pays the most — recovering an ancestor's memory should feel
// like real growth for the fire that walked you to it. Cache least — it's
// just supplies. Relic middle. Wild bands get nothing here; the battle pays.
function ruinXp(kind: RuinKind, lat: number): number {
  if (kind === "memory") return Math.round(10 + lat * 6);
  if (kind === "relic")  return Math.round(6 + lat * 4);
  if (kind === "cache")  return Math.round(4 + lat * 3);
  return 0;
}

// Bonus restorative chance on cache/relic bands — rare enough that finding
// one is a small dread-relief beat. PROVISIONAL 25%.
const RESTORATIVE_CHANCE = 0.25;

export function rollRuin(seedStr: string, flashbacksLeft: number, lat = 0): RuinRoll {
  const rng = new Rng(seedFrom(seedStr));
  const r = rng.nextFloat();
  const relic = RELICS[rng.nextInt(RELICS.length)];

  let kind: RuinKind;
  if (r < 0.3) kind = flashbacksLeft > 0 ? "memory" : "relic";
  else if (r < 0.55) kind = "relic";
  else if (r < 0.8) kind = "cache";
  else kind = "wild";

  const xp = ruinXp(kind, lat);
  // Bonus restorative roll: 25% on cache and relic bands. Memory/wild never.
  const restoratives =
    (kind === "cache" || kind === "relic") && rng.nextFloat() < RESTORATIVE_CHANCE
      ? 1
      : 0;

  if (kind === "memory") {
    return {
      kind, relicSpecies: "", provisions: 0,
      caches: 0, restoratives: 0, relicName: "",
      xp, message: "Glassed ruins — a memory surfaces from before the dark.",
    };
  }
  if (kind === "relic") {
    return {
      kind, relicSpecies: relic, provisions: 0.05,
      caches: 0, restoratives, relicName: relic,
      xp, message: `Glassed ruins. A relic: ${relic} — handless, but it tells a story.`,
    };
  }
  if (kind === "cache") {
    return {
      kind, relicSpecies: "", provisions: 0.18,
      caches: 1, restoratives, relicName: "",
      xp, message: "A sealed cache in the ruins — supplies recovered.",
    };
  }
  return {
    kind, relicSpecies: "", provisions: 0,
    caches: 0, restoratives: 0, relicName: "",
    xp: 0, message: "Something had been nesting in the ruins. A wild fire flares.",
  };
}
