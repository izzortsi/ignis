// Procedural Cinder art — ported from /workspace/mochi pet_art.py. A gacha of
// flame "parts" (core / flame / sparks / aura / hue) renders a flame creature
// at four growth stages (spark -> emberling -> ember -> fire) across five moods
// (idle / happy / eating / sleeping / dead), each a short looping animation.
//
// Ported faithfully (frames char-for-char) but made DETERMINISTIC: parts roll
// from the ignis Rng, so a Cinder's name seeds a stable identity (this replaces
// the old per-fire flicker glyph). Each frame is 12 rows x 20 chars.

import { Rng, seedFrom } from "../rng";
import { isAlive, isBurnBright, type Cinder } from "./cinder";

export type Frame = string[]; // 12 rows, each exactly 20 chars
export type Stage = "spark" | "emberling" | "ember" | "fire";
export type Mood = "idle" | "happy" | "eating" | "sleeping" | "dead";

export interface Parts {
  core: string;
  flame: string;
  sparks: string;
  aura: string;
  hue: string;
  rarity: Rarity;
}

// --- rarity -----------------------------------------------------------------

export type Rarity = "common" | "uncommon" | "rare" | "legendary";
const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "legendary"];
const RARITY_WEIGHTS: Record<Rarity, number> = { common: 60, uncommon: 25, rare: 12, legendary: 3 };

function rollRarity(rng: Rng): Rarity {
  const total = 100; // 60+25+12+3
  let r = rng.nextFloat() * total;
  for (const k of RARITY_ORDER) {
    r -= RARITY_WEIGHTS[k];
    if (r < 0) return k;
  }
  return "common";
}

type Lib = Record<Rarity, string[]>;

function pick(lib: Lib, rng: Rng): [string, Rarity] {
  const rarity = rollRarity(rng);
  let options = lib[rarity];
  if (options.length === 0) options = lib.common;
  return [options[rng.nextInt(options.length)], rarity];
}

// --- parts libraries (verbatim from pet_art.py) -----------------------------

const CORES: Lib = {
  common: [".", "o", "O", "0", "u", "*", "c", "e", "s"],
  uncommon: ["@", "8", "#", "%", "&", "6", "9", "g"],
  rare: ["$", "Q", "8", "*", "Z", "X", "K"],
  legendary: ["<>", "{}", "><", "()", "[]", "::"],
};
const FLAMES: Lib = {
  common: ["plain", "plain", "tall", "wide", "spire"],
  uncommon: ["curl", "split", "tall", "wide", "fork", "twist"],
  rare: ["curl", "split", "double", "fork", "plume"],
  legendary: ["crown", "triple", "halo", "plume", "spire"],
};
const SPARKS: Lib = {
  common: ["", "", "", ".", "'", "`"],
  uncommon: [".", "..", "' '", "* ", "..'", "` `"],
  rare: [". *", "* .", ".' '.", "* * *", ":*:", "*=*"],
  legendary: ["*.' '.*", "*.* *.*", "'*. .*'", ". * . * .", "*=*=*=*", "'.*.'.*"],
};
const AURAS: Lib = {
  common: ["", "", "", "", "."],
  uncommon: ["", "", "~", ".", "-"],
  rare: ["~~~", "* ~ *", "~ * ~", "-~-~-", "(~)"],
  legendary: ["*~*~*~*~*", "}}}~~{{{", "((~~~~))", "<~~~~~~~>", "=~=~=~=~="],
};
const HUES: Lib = {
  common: ["orange", "red", "yellow", "gold"],
  uncommon: ["ember", "amber", "crimson", "copper"],
  rare: ["blue", "teal", "violet", "jade"],
  legendary: ["white", "rainbow", "void", "prism"],
};

// Packed 0xRRGGBB per hue (the frontend styled these; ignis renders the colour).
export const HUE_COLOR: Record<string, number> = {
  orange: 0xff8a3c, red: 0xe85656, yellow: 0xf0c850, gold: 0xf4c430,
  ember: 0xff7a2a, amber: 0xffb347, crimson: 0xc8324b, copper: 0xc87a3a,
  blue: 0x78aaff, teal: 0x4fd0c0, violet: 0xb083ff, jade: 0x55c98a,
  white: 0xf2f0e8, rainbow: 0xff80c0, void: 0x7a6cff, prism: 0x9ad0ff,
};

// --- row helpers (verbatim semantics from pet_art.py) -----------------------

function normalizeRow(row: string): string {
  return row.slice(0, 20).padEnd(20);
}

function rowC(content: string): string {
  content = content.slice(0, 20);
  if (content.trim() === "") return " ".repeat(20);
  let start = 10 - Math.floor(content.length / 2);
  if (start < 0) start = 0;
  if (start + content.length > 20) start = Math.max(0, 20 - content.length);
  return normalizeRow(" ".repeat(start) + content);
}

function pad(rows: string[]): Frame {
  const r = rows.slice();
  while (r.length < 12) r.push(" ".repeat(20));
  return r.slice(0, 12).map(normalizeRow);
}

function tip(style: string, level: number): string {
  const i = level - 1;
  if (style === "crown") return ["/\\", "/\\/\\", "/\\*/\\"][i];
  if (style === "triple") return ["^", "^^^", "^^^^^"][i];
  if (style === "halo") return ["o", "(o)", "(o o)"][i];
  if (style === "double") return ["/\\", "/\\/\\", "/\\_/\\"][i];
  if (style === "split") return ["\\/", "\\_/", "\\_|_/"][i];
  if (style === "curl") return [")", "~)", "~)~"][i];
  if (style === "tall") return ["|", "/|\\", "/|||\\"][i];
  if (style === "wide") return ["~", "~~~", "~~~~~"][i];
  if (style === "fork") return ["Y", "\\Y/", "\\\\Y//"][i];
  if (style === "twist") return ["S", "(S)", "((S))"][i];
  if (style === "plume") return ["v", "vvv", "vvvvv"][i];
  if (style === "spire") return ["A", "/A\\", "/AAA\\"][i];
  return ["*", "***", "*****"][i];
}

function eyes(mood: Mood, core: string, variant: number): string {
  if (mood === "happy") return ["^", "*"][variant % 2];
  if (mood === "eating") return ["O", "o"][variant % 2];
  if (mood === "sleeping") return ["-", "_"][variant % 2];
  if (mood === "dead") return "+";
  // Idle pulses over 6 phases (the card's animation loop): the core glyph
  // shows through, dimming and guttering between beats.
  const c = core.slice(0, 1);
  return [c, ".", c, "·", c, ","][variant % 6];
}

function mouth(mood: Mood, variant: number): string {
  if (mood === "happy") return ["v", "U"][variant % 2];
  if (mood === "eating") return ["w", "u"][variant % 2];
  return "_";
}

function sparkPhase(sparks: string, variant: number): string {
  if (!sparks) return "";
  // Cyclic drift: each frame rotates the spark string, so sparks visibly
  // travel across the 6-frame loop instead of just flipping.
  const k = variant % sparks.length;
  return sparks.slice(k) + sparks.slice(0, k);
}

function smokeFrame(variant: number): Frame {
  const smoke = [
    ["'  .  '", " ` . ` ", "  ~ ~  ", " ~ . ~ ", "'  ~  '", " .   . "],
    [" ` . ` ", "  ~ ~  ", " ~ . ~ ", "'  ~  '", " .   . ", "       "],
    ["  ~ ~  ", " ~ . ~ ", "'  ~  '", " .   . ", "       ", "       "],
  ][variant % 3];
  const rows: string[] = new Array(12).fill("");
  for (let i = 0; i < smoke.length; i++) rows[i] = smoke[i].trim() ? rowC(smoke[i]) : "";
  rows[7] = rowC(". + . + .");
  rows[8] = rowC(" +  +  + ");
  rows[9] = rowC("  =====  ");
  rows[10] = rowC(" /     \\ ");
  rows[11] = rowC("==========");
  return pad(rows);
}

// --- per-stage frame builders ----------------------------------------------

type Builder = (mood: Mood, core: string, flame: string, sparks: string, aura: string, variant: number) => Frame;

// spark — a shy flicker: spark · flame lick · tiny face · curl base
// (DESIGN.ascii §2). ~4 visible rows, the cutest/minimal read.
const sparkFrame: Builder = (mood, core, flame, sparks, aura, variant) => {
  if (mood === "dead") return smokeFrame(variant);
  const eye = eyes(mood, core, variant);
  const mou = mouth(mood, variant);
  const sps = sparkPhase(sparks, variant);
  const rows: string[] = new Array(12).fill("");
  if (mood === "sleeping") {
    rows[6] = rowC(["z Z z", "Z z Z"][variant % 2]);
    rows[7] = rowC(`( ${eye}_${eye} )`);
    rows[8] = rowC("'-_-'");
    return pad(rows);
  }
  if (mood === "happy" && sps) rows[5] = rowC(sps.slice(0, 7));
  else if (mood === "eating") rows[5] = rowC([". + .", " + . +"][variant % 2]);
  else if (sps) rows[5] = rowC(sps.slice(0, 3));
  rows[6] = rowC(tip(flame, 1)); // crown ALWAYS via tip() (DESIGN.ascii §3)
  rows[7] = rowC(`( ${eye}${mou}${eye} )`);
  rows[8] = rowC("'-_-'");
  if (aura) rows[9] = rowC(aura.slice(0, 7));
  return pad(rows);
};

// emberling — the mascot (the bonded fire's pinned stage, DESIGN.ascii §1):
// collar+lick · round face · chin · little body · glowing feet.
const emberlingFrame: Builder = (mood, core, flame, sparks, aura, variant) => {
  if (mood === "dead") return smokeFrame(variant);
  const eye = eyes(mood, core, variant);
  const mou = mouth(mood, variant);
  const sps = sparkPhase(sparks, variant);
  const rows: string[] = new Array(12).fill("");
  if (mood === "sleeping") {
    rows[3] = rowC(["z Z z", "Z z Z"][variant % 2]);
    rows[4] = rowC(`,'${tip(flame, 1)}'.`);
    rows[5] = rowC(`,( ${eye}_${eye} ),`);
    rows[6] = rowC("\\ ._. /");
    rows[7] = rowC("(|||)");
    rows[8] = rowC(".=====.");
    return pad(rows);
  }
  if (sps && mood === "happy") rows[2] = rowC(sps.slice(0, 9));
  else if (mood === "eating") rows[3] = rowC([". + .", " + . +"][variant % 2]);
  else if (sps) rows[3] = rowC(sps.slice(0, 5));
  rows[4] = rowC(`,'${tip(flame, 1)}'.`);
  rows[5] = rowC(`( ${eye} ${mou} ${eye} )`);
  rows[6] = rowC("\\ ._. /");
  rows[7] = rowC("(|||)");
  rows[8] = rowC([".=====.", "*=====*"][variant % 2]);
  if (aura) rows[9] = rowC(aura.slice(0, 13));
  return pad(rows);
};

// ember — a standing flame-creature: layered tips · shoulders · roomier
// face · arms · legs · feet (DESIGN.ascii §2). ~9 visible rows.
const emberFrame: Builder = (mood, core, flame, sparks, aura, variant) => {
  if (mood === "dead") return smokeFrame(variant);
  const eye = eyes(mood, core, variant);
  const mou = mouth(mood, variant);
  const sps = sparkPhase(sparks, variant);
  const rows: string[] = new Array(12).fill("");
  if (mood === "sleeping") {
    rows[1] = rowC(["z Z z", "Z z Z"][variant % 2]);
    rows[2] = rowC(tip(flame, 1));
    rows[3] = rowC(",-'''-,");
    rows[4] = rowC(`( ${eye} _ ${eye} )`);
    rows[5] = rowC("\\.___./");
    rows[6] = rowC("(|||)");
    rows[7] = rowC("/|_|\\");
    rows[8] = rowC("[=====]");
    return pad(rows);
  }
  if (sps && mood === "happy") rows[0] = rowC(sps.slice(0, 11));
  else if (mood === "eating") rows[1] = rowC([". + . + .", " + . + . "][variant % 2]);
  else if (sps) rows[1] = rowC(sps.slice(0, 7));
  rows[2] = rowC(tip(flame, 1));
  rows[3] = rowC(tip(flame, 2));
  rows[4] = rowC(",-'''-,");
  rows[5] = rowC(`( ${eye} ${mou} ${eye} )`);
  rows[6] = rowC("\\.___./");
  rows[7] = rowC(")/ \\(");
  rows[8] = rowC("/|_|\\");
  rows[9] = rowC(["[=====]", "[=~=~=]"][variant % 2]);
  if (aura) rows[10] = rowC(aura.slice(0, 11));
  return pad(rows);
};

// fire — a full bonfire: ember crown · tall flames · broad logs. Faceless
// and architectural — majestic, NOT a face-forward creature (the decided
// cute→majestic top end, DESIGN.ascii §1/§5 O-B).
const fireFrame: Builder = (mood, _core, flame, sparks, aura, variant) => {
  if (mood === "dead") return smokeFrame(variant);
  const sps = sparkPhase(sparks, variant);
  const rows: string[] = new Array(12).fill("");
  if (mood === "sleeping") {
    // banked low for the night — a short crown over settled logs
    rows[3] = rowC(["z Z z", "Z z Z"][variant % 2]);
    rows[4] = rowC(tip(flame, 2));
    rows[5] = rowC("_|||_");
    rows[6] = rowC("[==|||==]");
    rows[7] = rowC("[========]");
    rows[8] = rowC("[________]");
    return pad(rows);
  }
  if (sps && mood === "happy") rows[0] = rowC(sps.slice(0, 13));
  else if (sps) rows[0] = rowC(sps.slice(0, 9));
  rows[1] = rowC(tip(flame, 2));
  rows[2] = rowC(tip(flame, 3));
  if (mood === "happy") rows[3] = rowC(["*'. * .'*", "'.* * *.'"][variant % 2]);
  else if (mood === "eating") rows[3] = rowC([". * + * .", " * . + . *"][variant % 2]);
  else rows[3] = rowC(["\\ ||| /", " \\|||/ "][variant % 2]);
  rows[4] = rowC("\\\\|||||//");
  rows[5] = rowC("__|||||__");
  rows[6] = rowC(["[===|||===]", "[==|||==]"][variant % 2]);
  rows[7] = rowC("[============]");
  rows[8] = rowC("[____________]");
  rows[9] = aura ? rowC(aura.slice(0, 17)) : rowC("\\  '  /");
  return pad(rows);
};

const STAGE_BUILDERS: Record<Stage, Builder> = {
  spark: sparkFrame,
  emberling: emberlingFrame,
  ember: emberFrame,
  fire: fireFrame,
};

const MOOD_FRAME_COUNT: Record<Mood, number> = {
  idle: 6, happy: 6, eating: 4, sleeping: 2, dead: 3,
};

// --- public API -------------------------------------------------------------

export function rollParts(rng: Rng): Parts {
  const [core, cr] = pick(CORES, rng);
  const [flame, fr] = pick(FLAMES, rng);
  const [sparks, sr] = pick(SPARKS, rng);
  const [aura, ar] = pick(AURAS, rng);
  const [hue, hr] = pick(HUES, rng);
  const best = [cr, fr, sr, ar, hr].reduce((a, b) =>
    RARITY_ORDER.indexOf(b) > RARITY_ORDER.indexOf(a) ? b : a,
  );
  return { core, flame, sparks, aura, hue, rarity: best };
}

// Every mood's animation: { mood -> [frame0, frame1, ...] }.
export function render(stage: Stage, parts: Parts): Record<Mood, Frame[]> {
  const builder = STAGE_BUILDERS[stage] ?? sparkFrame;
  const moods: Mood[] = ["idle", "happy", "eating", "sleeping", "dead"];
  const out = {} as Record<Mood, Frame[]>;
  for (const mood of moods) {
    const n = MOOD_FRAME_COUNT[mood];
    out[mood] = [];
    for (let v = 0; v < n; v++) {
      out[mood].push(builder(mood, parts.core, parts.flame, parts.sparks, parts.aura, v));
    }
  }
  return out;
}

// --- Cinder integration hooks (PROVISIONAL thresholds) ----------------------

// Stable identity: a Cinder's name seeds its parts (same name => same art).
export function partsForName(name: string): Parts {
  return rollParts(new Rng(seedFrom("petart:" + name)));
}

// Growth stage. Circle-fires stay small; the bonded fire grows with its bond
// (and burn-bright) toward a full bonfire.
export function stageForCinder(c: Cinder): Stage {
  if (!c.bonded) return c.vitality > 0.6 ? "emberling" : "spark";
  const growth = c.bond + (isBurnBright(c) ? 0.15 : 0);
  if (growth < 0.2) return "spark";
  if (growth < 0.5) return "emberling";
  if (growth < 0.8) return "ember";
  return "fire";
}

export function moodForCinder(c: Cinder): Mood {
  if (!isAlive(c)) return "dead";
  if (c.vitality < 0.2) return "sleeping";
  if (isBurnBright(c)) return "happy";
  return "idle";
}

// Convenience: the full art for a Cinder at its current stage.
export function cinderArt(c: Cinder): Record<Mood, Frame[]> {
  return render(stageForCinder(c), partsForName(c.name));
}

// --- canonical stable presentation -----------------------------------------
// DIRECTIVE: pet art is the SAME EVERYWHERE (camp / dex / battle) and a pure
// function of the Cinder's identity — NEVER of vitality / coherence / bond /
// burn-bright (no mid-fight morphing). Variety comes from TWO stable axes:
//  - richer name-seeded parts (the gacha pools above), and
//  - a name-seeded STAGE tier (full spark→fire range) so the bestiary differs
//    in size/silhouette.
// The bonded Cinder STARTS as an emberling (small); a deliberate EVOLUTION
// (TBD) is the only thing that will ever raise its stage. stageForCinder /
// moodForCinder above stay as that future evolution hook.

const ALL_STAGES: Stage[] = ["spark", "emberling", "ember", "fire"];

// A Cinder's STABLE stage tier, rolled from its name on a stream of its own
// (independent of the parts roll). Same name => same stage, forever.
export function stageForName(name: string): Stage {
  return ALL_STAGES[new Rng(seedFrom("petartstage:" + name)).nextInt(ALL_STAGES.length)];
}

// The canonical stage drawn everywhere: the bonded fire is the player's
// starting emberling (evolution TBD raises it); every other fire keeps its
// name-seeded tier across the full range.
export function canonStage(c: Cinder): Stage {
  return c.bonded ? "emberling" : stageForName(c.name);
}

export function cinderMoodStable(isBurning: boolean): Mood {
  return isBurning ? "idle" : "dead";
}

// The animation loop to draw for a Cinder — canonical, identical everywhere.
export function cinderFramesStable(c: Cinder): Frame[] {
  return render(canonStage(c), partsForName(c.name))[cinderMoodStable(isAlive(c))];
}
