// Shared flashback art access (the dense ASCII "memory" pieces). Core owns the
// flashback identity/caption (core/flashback); the heavy art lives in the
// intro's scene-art and is mapped here by id so every memorial surface (the
// title trophy room AND the camp memories tab) renders the same cards.

import { type FlashbackId } from "../core/flashback";
import { RIO_MIYAKE, MIRROR_LEAK } from "./intro/scene-art";

export const FLASH_ART: Record<FlashbackId, string[]> = {
  "rio-miyake": RIO_MIYAKE,
  "mirror-leak": MIRROR_LEAK,
};

// A bounded teaser band of a dense piece — small DOM for a card preview; CSS
// shrinks the glyphs. The full memory is the expanded view / the intro itself.
export function flashThumb(art: string[]): string {
  const start = Math.floor(art.length * 0.32);
  const band: string[] = [];
  for (let i = start; i < start + 16 && i < art.length; i++) band.push(art[i].slice(0, 104));
  return band.join("\n");
}

// The whole dense piece (CSS scales it to fit; the scroll container handles
// overflow). Used when a recovered card is opened.
export function flashFull(art: string[]): string {
  return art.join("\n");
}
