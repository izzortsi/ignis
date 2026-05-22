// The Cinder's voice (DESIGN: the bond materializes through diction). Pure
// module: takes a Cinder and a situation, returns a short felt line the fire
// itself speaks. Manner (confident/cautious/histrionic) shapes the diction;
// the same band read by three different fires sounds like three different
// personalities. The line is short, quoted, prefixed by the fire's name.
//
// Determinism: a fire's voice draws are deterministic per (name, situation,
// turn-index) via seedFrom. Same fire reading the same situation in the same
// inference will produce the same line; across inferences the variant cycles
// naturally as draws advance. This is consistent personality, not random.
//
// Situations:
// - "read-band" (Tide encounters): fire speaks its verdict on a sample
// - "battle-event" (Battle): fire speaks its attack/miss/utility — for both
//   player AND foe (combat becomes a dialogue between two fires).

import { Rng, seedFrom } from "../rng";
import type { Cinder } from "./cinder";
import type { Band } from "./reading";
import type { FireManner } from "./reading";

export type VoiceSituation = "read-band" | "battle-event";

// Battle events the voice speaks for. Maps to TurnEvent.text + miss flag:
// - "hit-strong": a press/feint/joint landed with high effectiveness (≥1.0)
// - "hit-weak": landed but barely (effectiveness < 1.0)
// - "miss": the read scattered, nothing took
// - "bank": utility move (Error-Correct) — the fire gathers itself
// - "guard": defensive move (Anneal) — the fire sets hard
export type BattleEventKind = "hit-strong" | "hit-weak" | "miss" | "bank" | "guard";

export interface VoiceParams {
  band?: Band;
  battleEvent?: BattleEventKind;
}

// Line pools — 6 bands × 3 manners × 8 lines = 144 read-band variants.
// The diction shape per manner is consistent across all bands:
// - confident: crisp, declarative, no hedge ("X. Y.")
// - cautious: hedged, soft, conditional ("X, I think." / "leaning X.")
// - histrionic: overstated, exclaiming, dramatic ("X! EAT!" / "GODS!")
const READ_LINES: Record<Band, Record<FireManner, string[]>> = {
  "of-our-hand": {
    confident: [
      "of our hand. eat without thought.",
      "clean. I'd swear it.",
      "ours. through and through.",
      "no fault in this one.",
      "safe. set the table.",
      "the hand sits true.",
      "I read no trick. eat it.",
      "ours, beyond doubt.",
    ],
    cautious: [
      "of our hand... I think.",
      "clean, as far as I can tell.",
      "I lean ours. but read again, if it troubles you.",
      "I don't see a trick. probably safe.",
      "the hand sits well. probably.",
      "ours, I'd say. softly.",
      "no fault I can find.",
      "leaning safe.",
    ],
    histrionic: [
      "OURS! eat without fear!",
      "clean! magnificent!",
      "of our hand — gods, it's wholesome!",
      "feast! it's ours through and through!",
      "I'd stake the world on it — eat!",
      "ours, you precious thing! safe!",
      "the hand sings true!",
      "clean! a gift!",
    ],
  },
  "seems-of-our-hand": {
    confident: [
      "seems ours. likely safe.",
      "leans clean. eat with care.",
      "weak but ours. set it down for now.",
      "the hand whispers ours.",
      "ours, I'd say. faintly.",
      "clean — faint, but clean.",
      "the read leans safe.",
      "ours, in the dim.",
    ],
    cautious: [
      "seems ours... I'm not certain.",
      "leans clean, but only just. read again.",
      "ours, perhaps. I wouldn't stake it.",
      "the hand is there, faint. wait, maybe.",
      "I think it's ours. don't trust me alone.",
      "probably safe. probably.",
      "leans clean. but the night is loud.",
      "ours? I'd hold it back, just in case.",
    ],
    histrionic: [
      "ours! probably! mostly!",
      "clean — I think — clean enough!",
      "leans ours! eat, but watch your tongue!",
      "the hand! it's there! barely!",
      "ours! it MUST be ours!",
      "clean enough! brave the bite!",
      "leans safe! the night plays tricks!",
      "ours! ours, I say! probably!",
    ],
  },
  "fire-hesitates": {
    confident: [
      "I can't call this one. read again.",
      "the read won't sit. try another fire.",
      "I won't choose. neither side wins.",
      "hold. I have nothing clean.",
      "the hands cross. wait.",
      "I refuse. find me another sample.",
      "no call. the wind is wrong.",
      "I hesitate. I won't pretend.",
    ],
    cautious: [
      "I'm not sure... it could go either way.",
      "I hesitate. I don't trust what I'm reading.",
      "I can't tell. honest.",
      "the read shifts. I'd want a second.",
      "neither way. I won't guess.",
      "I'd rather not say. let it sit.",
      "uncertain. truly.",
      "the fire hesitates. read again, please.",
    ],
    histrionic: [
      "I CAN'T! it WON'T resolve!",
      "the hand vanishes! it MOCKS me!",
      "no call! no call! gods, no call!",
      "the read scatters! I am BLIND!",
      "I REFUSE to guess!",
      "hold! HOLD! I see nothing!",
      "the wind! the wind! it CHEATS me!",
      "I cannot — will not — call this!",
    ],
  },
  "seems-touched": {
    confident: [
      "seems touched. set it aside.",
      "leans wrong. don't risk it.",
      "the touch is faint, but I see it. discard.",
      "wrong-handed, I'd say. carefully.",
      "the mirror's mark, faint. quarantine.",
      "leans touched. burn or bury, your call.",
      "the wrong hand. set it down.",
      "touched, weakly. don't taste it.",
    ],
    cautious: [
      "seems touched... I might be wrong.",
      "leans wrong, but only just. read again.",
      "touched, perhaps. I wouldn't risk it either way.",
      "the mirror's faint here. discard, to be safe.",
      "leans wrong. softly.",
      "I think it's touched. don't eat it.",
      "wrong-handed? maybe. don't taste it.",
      "touched, I'd guess. quarantine, please.",
    ],
    histrionic: [
      "touched! get it AWAY!",
      "the wrong hand! BURN it!",
      "leans wrong! don't TOUCH it!",
      "the mirror! the mirror's mark!",
      "wrong! WRONG! discard at once!",
      "touched! a child could die over this!",
      "the mark is there! burn it now!",
      "wrong-handed! gods, don't taste it!",
    ],
  },
  "touched": {
    confident: [
      "touched. burn it.",
      "the wrong hand. don't handle it.",
      "mirror, through and through. fire.",
      "burn this. now.",
      "the mark sits deep. burn.",
      "wrong-handed, fully. fire and salt.",
      "touched. I won't read it twice.",
      "burn. don't argue.",
    ],
    cautious: [
      "touched, I'm afraid. burn it.",
      "the wrong hand sits deep. please burn.",
      "mirror. I wish it weren't, but burn.",
      "touched. I'd rather be wrong, but burn it.",
      "the mark is here. burn, please.",
      "wrong-handed. don't try to save it.",
      "touched. fire is kindest.",
      "burn. there's no other way.",
    ],
    histrionic: [
      "TOUCHED! gods, BURN IT!",
      "the wrong hand! the WRONG HAND!",
      "mirror! mirror! to the FIRE!",
      "burn it! BURN IT! don't look twice!",
      "touched! a curse! incinerate!",
      "WRONG! WRONG! fire and ash!",
      "the mark sears me! get it OUT!",
      "BURN! before it touches another!",
    ],
  },
  "handless": {
    confident: [
      "handless. nothing to read.",
      "no chirality. an empty thing.",
      "inert. no hand at all.",
      "the fire finds no purchase. handless.",
      "nothing. neither ours nor wrong.",
      "no hand. it's just stone, or metal, or bone.",
      "handless. read no further.",
      "no chirality here. it's dead matter.",
    ],
    cautious: [
      "handless, I think. nothing to read.",
      "no hand. probably just dead matter.",
      "inert, as far as I can tell.",
      "the fire finds nothing. probably handless.",
      "no chirality. it seems dead.",
      "handless. read it again if it troubles you.",
      "no hand here. likely just stone.",
      "inert? I'd say so. softly.",
    ],
    histrionic: [
      "HANDLESS! a nothing! a void!",
      "no hand! the fire LAUGHS at it!",
      "inert! dead! cold!",
      "no chirality! not a whisper!",
      "handless! an empty husk!",
      "the fire finds NOTHING! glorious!",
      "no hand! it's just BONE!",
      "inert! inert! inert! I'd stake on it!",
    ],
  },
};

// Battle-event line pools — 5 events × 3 manners × 6 lines = 90 lines.
// Both player and foe fires draw from these. The fire SPEAKS its action,
// brags, curses, focuses — combat becomes a dialogue between two fires.
const BATTLE_LINES: Record<BattleEventKind, Record<FireManner, string[]>> = {
  "hit-strong": {
    confident: [
      "deep. that one will sting.",
      "I had the read. clean through.",
      "true. and hard.",
      "the line held.",
      "I took it whole.",
      "right through. nothing held.",
    ],
    cautious: [
      "that... that landed.",
      "I think I had it. yes.",
      "deep, I'd say. softly.",
      "true enough. I caught the line.",
      "it took. it really took.",
      "I had the read. I think.",
    ],
    histrionic: [
      "YES! I had the line!",
      "DEEP! gods, DEEP!",
      "true! TRUE! straight through!",
      "I took it WHOLE!",
      "the read SANG!",
      "BURN! through and through!",
    ],
  },
  "hit-weak": {
    confident: [
      "barely. but a hit.",
      "glancing. I'll take it.",
      "thin, but it tells.",
      "weak. I'll do better.",
      "grazed. enough.",
      "not deep. not nothing.",
    ],
    cautious: [
      "I barely caught it...",
      "weak. I should've held longer.",
      "a graze. better than nothing.",
      "I had it, but only just.",
      "thin. I'll find a cleaner read.",
      "scarcely a hit. but a hit.",
    ],
    histrionic: [
      "barely! I had it BARELY!",
      "graze! one breath off!",
      "WEAK! gods, I held wrong!",
      "thin! it tells, but THIN!",
      "scarcely! the wind cheated me!",
      "I caught it! barely!",
    ],
  },
  "miss": {
    confident: [
      "scattered. damn.",
      "the read broke. wait.",
      "I lost it. one moment.",
      "nothing took. read again.",
      "wide. I'll close it next time.",
      "scattered. find me a still moment.",
    ],
    cautious: [
      "I... I lost it.",
      "the read scattered. forgive me.",
      "nothing. I'm sorry.",
      "I had it. and then I didn't.",
      "scattered. I'll try again.",
      "wide. truly wide.",
    ],
    histrionic: [
      "GONE! scattered to NOTHING!",
      "the wind! the wind, again!",
      "I LOST it! the line slipped!",
      "WIDE! wide of everything!",
      "nothing! nothing took!",
      "scattered! gods, scattered!",
    ],
  },
  "bank": {
    confident: [
      "gathering. don't speak.",
      "I find the order. quietly.",
      "correcting. give me a moment.",
      "I sort the noise.",
      "the read settles.",
      "banked. ready again.",
    ],
    cautious: [
      "let me gather myself...",
      "I'm finding the order. slowly.",
      "correcting. forgive the pause.",
      "the noise... I sort it.",
      "banking. one breath.",
      "I settle. let me settle.",
    ],
    histrionic: [
      "GATHERING! hold!",
      "the order! I FIND it!",
      "correcting! gods, correcting!",
      "the noise! I SORT it!",
      "banked! ready! ready!",
      "settle! settle, fire, settle!",
    ],
  },
  "guard": {
    confident: [
      "I set hard. nothing through.",
      "annealed. wait.",
      "the shape holds. firm.",
      "I draw in. the line braces.",
      "set. nothing reaches.",
      "the fire holds its ground.",
    ],
    cautious: [
      "I draw in... try to.",
      "set. I think.",
      "the shape holds. probably.",
      "annealed. for now.",
      "I brace. softly.",
      "the fire pulls in. holding.",
    ],
    histrionic: [
      "SET! the fire HOLDS!",
      "annealed! gods, ANNEALED!",
      "the shape! it BRACES!",
      "I DRAW IN!",
      "HARD! nothing reaches!",
      "the fire HOLDS the line!",
    ],
  },
};

// A counter per (fire-name, situation) so consecutive draws cycle through the
// pool rather than repeating. Module-scoped because fireVoice is a pure
// function — the counter is the draw index, not the fire's state.
const drawCounters = new Map<string, number>();

function nextDraw(key: string): number {
  const cur = drawCounters.get(key) ?? 0;
  drawCounters.set(key, cur + 1);
  return cur;
}

// Reset draws (e.g. for a fresh battle or fresh tide encounter). Lets the
// voice pattern re-shuffle without persisting count across unrelated events.
export function resetVoiceDraws(): void {
  drawCounters.clear();
}

export function fireVoice(
  cinder: Cinder,
  situation: VoiceSituation,
  params: VoiceParams,
): string {
  if (situation === "read-band") {
    const band = params.band;
    if (band === undefined) return `${cinder.name}: '...'`;
    const pool = READ_LINES[band][cinder.manner];
    const key = `${cinder.name}|${situation}`;
    const draw = nextDraw(key);
    const rng = new Rng(seedFrom(`voice:${cinder.name}:${situation}:${draw}`));
    const line = pool[rng.nextInt(pool.length)];
    return `${cinder.name}: '${line}'`;
  }
  if (situation === "battle-event") {
    const kind = params.battleEvent;
    if (kind === undefined) return `${cinder.name}: '...'`;
    const pool = BATTLE_LINES[kind][cinder.manner];
    const key = `${cinder.name}|${situation}|${kind}`;
    const draw = nextDraw(key);
    const rng = new Rng(seedFrom(`voice:${cinder.name}:${situation}:${kind}:${draw}`));
    const line = pool[rng.nextInt(pool.length)];
    return `${cinder.name}: '${line}'`;
  }
  return `${cinder.name}: '...'`;
}
