// The bestiary (DESIGN.md §10; bible §5, §12). Real species the Reading
// catalogues: mirror-life, native life, and inert decoys (handless, no
// chirality to read). `look` is what the apprentice sees; `tell` is the
// Reading clue. Tide encounters and the Dex both draw from this one table.

import type { Rng } from "../rng";
import type { Truth, SampleClass } from "./reading";

export interface Species {
  id: string;
  name: string;
  trueClass: Truth;
  sample: SampleClass;
  look: string;
  tell: string;
}

export const BESTIARY: Species[] = [
  // --- mirror-life: warm-water, full-light; the danger that rises south ---
  { id: "foam-mat", name: "foam mat", trueClass: "mirror", sample: "water",
    look: "a pale froth knitting itself across still water",
    tell: "reads touched when fresh; the signal dulls as it dries" },
  { id: "oily-bloom", name: "oily bloom", trueClass: "mirror", sample: "water",
    look: "an iridescent slick that sheds the light wrong",
    tell: "strong touched; mirrors in the slick can scatter a weak fire" },
  { id: "wrong-handed-fern", name: "wrong-handed fern", trueClass: "mirror", sample: "grain",
    look: "a fern whose veins run the wrong way, faintly oiled",
    tell: "touched, but a tired fire often only manages seems-touched" },
  { id: "glass-cane", name: "glass-cane reed", trueClass: "mirror", sample: "grain",
    look: "a reed too clear, ringing faintly in wind",
    tell: "touched; clearer samples read sharper here than most" },
  { id: "yellow-husk-lark", name: "yellow-husk lark", trueClass: "mirror", sample: "flesh",
    look: "a bird starved full — yellowed, hollow, light as husk",
    tell: "flesh reads noisier; a strong fire still calls it touched" },
  { id: "wax-hare", name: "wax hare", trueClass: "mirror", sample: "flesh",
    look: "a hare gone waxen, its blood slow and bright",
    tell: "blood is the noisiest sample; weak fires hesitate or lie" },

  // --- native life: of our hand; safe, and worth not burning ---
  { id: "river-cress", name: "river cress", trueClass: "native", sample: "water",
    look: "dark cress trailing in a cold current",
    tell: "of our hand; a sharp fire is confident here" },
  { id: "true-grain", name: "true-grain ear", trueClass: "native", sample: "grain",
    look: "a heavy, dull-gold ear of true grain",
    tell: "of our hand; spore-fouled air can still blur it south" },
  { id: "snare-hare", name: "snare hare", trueClass: "native", sample: "flesh",
    look: "a lean hare from the snares, ordinary and welcome",
    tell: "of our hand, but flesh adds noise — read it twice if unsure" },
  { id: "kettle-root", name: "kettle root", trueClass: "native", sample: "grain",
    look: "a knuckled root that boils sweet",
    tell: "of our hand; an easy, steady read" },
  { id: "char-moss", name: "char moss", trueClass: "native", sample: "water",
    look: "sooty moss clinging where water pools",
    tell: "of our hand; reads clean in still air" },
  { id: "ash-thistle", name: "ash thistle", trueClass: "native", sample: "grain",
    look: "a hardy grey thistle that takes the burnt ground",
    tell: "of our hand; the seedheads scatter a careless read" },
  { id: "fen-eel", name: "fen eel", trueClass: "native", sample: "flesh",
    look: "a dark eel hauled from the snare-pools",
    tell: "of our hand, but eel-flesh is slick — read it twice" },

  // --- more mirror-life, met deeper south ---
  { id: "spore-veil", name: "spore veil", trueClass: "mirror", sample: "water",
    look: "a drifting green film that hangs in still water",
    tell: "touched; the veil thins and the signal fades if it settles" },
  { id: "mirror-roe", name: "mirror roe", trueClass: "mirror", sample: "flesh",
    look: "a clutch of glassy eggs from something that ate wrong",
    tell: "strong touched; the cluster reads louder than one" },
  { id: "candle-lichen", name: "candle lichen", trueClass: "mirror", sample: "grain",
    look: "a waxy lichen whose growth spirals the wrong way",
    tell: "touched; a tired fire softens it to seems-touched" },

  // --- inert: handless; no chirality to read at all ---
  { id: "river-stone", name: "river stone", trueClass: "inert", sample: "stone",
    look: "a smooth cold stone from the bed",
    tell: "handless — a sharp fire says so plainly; a dying one wavers" },
  { id: "scouts-buckle", name: "scout's buckle", trueClass: "inert", sample: "gear",
    look: "a returned scout's bronze buckle, still warm",
    tell: "handless; reflections off the metal can fool a weak fire" },
  { id: "cured-strap", name: "cured strap", trueClass: "inert", sample: "gear",
    look: "a fully cured leather strap, long dead",
    tell: "handless — nothing to read, but easy to over-think" },
  { id: "bone-whistle", name: "bone whistle", trueClass: "inert", sample: "gear",
    look: "a whistle carved from old bone, long cured",
    tell: "handless; its hollow note unsettles a nervous reader" },
];

export function speciesByClass(c: Truth): Species[] {
  return BESTIARY.filter((s) => s.trueClass === c);
}

export function pickSpecies(rng: Rng, c: Truth): Species {
  const pool = speciesByClass(c);
  return pool[rng.nextInt(pool.length)];
}

export function speciesByName(name: string): Species | undefined {
  return BESTIARY.find((s) => s.name === name);
}
