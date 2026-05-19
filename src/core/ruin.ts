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
  relicSpecies: string; // meaningful only for "relic"
  provisions: number; // signed delta applied for "relic"/"cache" (0 otherwise)
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

export function rollRuin(seedStr: string, flashbacksLeft: number): RuinRoll {
  const rng = new Rng(seedFrom(seedStr));
  const r = rng.nextFloat();
  const relic = RELICS[rng.nextInt(RELICS.length)];

  let kind: RuinKind;
  if (r < 0.3) kind = flashbacksLeft > 0 ? "memory" : "relic";
  else if (r < 0.55) kind = "relic";
  else if (r < 0.8) kind = "cache";
  else kind = "wild";

  if (kind === "memory") {
    return { kind, relicSpecies: "", provisions: 0, message: "Glassed ruins — a memory surfaces from before the dark." };
  }
  if (kind === "relic") {
    return { kind, relicSpecies: relic, provisions: 0.05, message: `Glassed ruins. A relic: ${relic} — handless, but it tells a story.` };
  }
  if (kind === "cache") {
    return { kind, relicSpecies: "", provisions: 0.18, message: "A sealed cache in the ruins — supplies recovered." };
  }
  return { kind, relicSpecies: "", provisions: 0, message: "Something had been nesting in the ruins. A wild fire flares." };
}
