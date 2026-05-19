// Bridge from the ASCII chapada (a Screen scene in Game's loop) to a Solid
// encounter component. The chapada raises a request instead of pushing an
// ASCII sub-scene; Game pauses its loop and mounts the Solid encounter; on
// finish the request clears, the loop resumes, and the chapada's existing
// pendingSub path marks the site resolved.

import { createSignal } from "solid-js";
import type { RunState } from "./run";
import type { MapNode } from "./routemap";
import type { BattleSource } from "./battle";

export type EncounterKind = "tide" | "battle";

export interface EncounterReq {
  kind: EncounterKind;
  run: RunState;
  node?: MapNode; // battle needs it for deterministic seeding; tide ignores it
  nonce?: number; // per-encounter salt → a fresh foe each battle in a leg
  source?: BattleSource; // grass/rubble = wild encounter · duel = a person
}

const [req, setReq] = createSignal<EncounterReq | null>(null);

export const encounterRequest = req;

export function requestEncounter(
  kind: EncounterKind,
  run: RunState,
  node?: MapNode,
  nonce?: number,
  source?: BattleSource,
): void {
  setReq({ kind, run, node, nonce, source });
}

// Called by the Solid encounter component once it has applied its outcome.
export function finishEncounter(): void {
  setReq(null);
}
