// Flashbacks — dense ASCII "memories from a forgotten past" (bible §9). Two
// exist now; the Initiation prelude shows both. Seeing a flashback RECOVERS it
// into the persisted memory gallery (the Memorial). The heavy art lives in the
// UI (ui/intro/scene-art.ts) so core stays pure & testable — core owns only
// each memory's identity, title, and one elegiac caption. More flashbacks
// (recovered in ruins, etc.) are TBD.

export type FlashbackId = "rio-miyake" | "mirror-leak";

export interface Flashback {
  id: FlashbackId;
  title: string;
  caption: string; // one line for the memorial card
}

export const FLASHBACKS: Flashback[] = [
  {
    id: "rio-miyake",
    title: "Rio Miyake",
    caption: "The Miyake-class flare. The sky burned white; the grids went dark.",
  },
  {
    id: "mirror-leak",
    title: "The Mirror Leak",
    caption: "Containment failed. What we held apart from the world got out.",
  },
];

export function flashbackById(id: string): Flashback | null {
  for (let i = 0; i < FLASHBACKS.length; i++) {
    if (FLASHBACKS[i].id === id) return FLASHBACKS[i];
  }
  return null;
}

// Flashbacks not yet in `collected` (registry order is the recovery order).
export function unrecoveredFlashbacks(collected: string[]): Flashback[] {
  return FLASHBACKS.filter((f) => collected.indexOf(f.id) < 0);
}
