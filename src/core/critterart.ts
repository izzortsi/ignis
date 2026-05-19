// Procedural creature sprites for the bestiary (the things you meet in the
// grass / a mirror-tide). Distinct from petart (which draws the fire). Each
// species' sprite is deterministic from its id, and the silhouette is themed
// by its true class so the player can learn to read shapes:
//   - mirror  : oily, asymmetric, dripping, wrong-handed
//   - native  : clean and symmetric — an animal (flesh) or a plant
//   - inert   : a static object, no face
//
// Fixed 7 rows x 13 cols so callers can place it without measuring.

import { Rng, seedFrom } from "../rng";
import type { Species } from "./bestiary";
import type { Truth } from "./reading";

export const CW = 13;
export const CH = 7;

// Packed 0xRRGGBB; the scene paints with these (core stays screen-free).
export const CRITTER_COLOR: Record<Truth, number> = {
  mirror: 0x60dc96,
  native: 0x78aaff,
  inert: 0x8a90a0,
};

function row(content: string): string {
  const c = content.slice(0, CW);
  if (c.trim() === "") return " ".repeat(CW);
  let start = Math.floor((CW - c.length) / 2);
  if (start < 0) start = 0;
  if (start + c.length > CW) start = Math.max(0, CW - c.length);
  return (" ".repeat(start) + c).slice(0, CW).padEnd(CW);
}

function pad(rows: string[]): string[] {
  const r = rows.slice(0, CH);
  while (r.length < CH) r.push(" ".repeat(CW));
  return r.map((s) => s.slice(0, CW).padEnd(CW));
}

function pick<T>(rng: Rng, xs: T[]): T {
  return xs[rng.nextInt(xs.length)];
}

// --- mirror: oily blob, off-centre eye, drips, wrong-handed lean -----------
function mirrorSprite(rng: Rng): string[] {
  const b = pick(rng, ["%", "@", "&", "#", "o", "8"]);
  const eye = pick(rng, ["o", "O", "@", "*", "·"]);
  const drip = pick(rng, ["'", ",", ".", "`"]);
  const sheen = pick(rng, ["*", "~", "'", "°"]);
  const lean = rng.nextInt(3) - 1; // -1,0,1 — asymmetry
  const sp = (n: number) => " ".repeat(Math.max(0, n));
  const bb = b.repeat(3);
  return pad([
    row(`${sheen}   ${sheen} ${sheen}`),
    row(`${sp(1 + Math.max(0, lean))},${b}${b}${b},`),
    row(`(${b}${eye}${bb}${b})`),
    row(`(${bb}${bb}${b})`),
    row(`${sp(1 - Math.min(0, lean))}\`${b}${b}${b}${b}'`),
    row(`${drip}  ${drip} ${drip}`),
    row(""),
  ]);
}

// --- native animal: ears, eyes, body, legs --------------------------------
function animalSprite(rng: Rng): string[] {
  const ears = pick(rng, ["/\\ /\\", "(  )", "^^ ^^", "n   n"]);
  const eye = pick(rng, ["o", "^", "•", "u"]);
  const body = pick(rng, ["=", "o", "~", "-"]).repeat(6);
  const legs = pick(rng, ["/ | | \\", "n n n n", "| | | |", "J L J L"]);
  const tail = pick(rng, ["~", ">", ")", ""]);
  return pad([
    row(""),
    row(ears),
    row(`( ${eye}   ${eye} )`),
    row(`(${body})${tail}`),
    row(`(${body})`),
    row(legs),
    row(""),
  ]);
}

// --- native plant: bloom, stem, leaves, base ------------------------------
function plantSprite(rng: Rng): string[] {
  const bloom = pick(rng, ["*", "o", "@", "%", "(o)"]);
  const leafL = pick(rng, ["\\", "<", "{", "("]);
  const leafR = pick(rng, ["/", ">", "}", ")"]);
  const stem = pick(rng, ["|", "‖", "}", "I"]);
  return pad([
    row(""),
    row(`  ${bloom}  `),
    row(`${leafL}_${stem}_${leafR}`),
    row(` ${leafL}${stem}${leafR} `),
    row(`  ${stem}  `),
    row(` .${stem}. `),
    row(`.:===:.`),
  ]);
}

// --- inert: a static object, no face --------------------------------------
function inertSprite(rng: Rng): string[] {
  const shape = rng.nextInt(4);
  if (shape === 0) return pad([row(""), row("┌─────┐".replace(/[─┌┐]/g, "=")), row("|     |"), row("|     |"), row("|_____|"), row(""), row("")]);
  if (shape === 1) return pad([row(""), row(" .===. "), row("(     )"), row(" `===' "), row(""), row(""), row("")]);
  if (shape === 2) return pad([row(""), row(""), row("==<#>=="), row(""), row(""), row(""), row("")]);
  return pad([row(""), row("  /\\  "), row(" <  > "), row("  \\/  "), row(""), row(""), row("")]);
}

export function critterSprite(s: Species): string[] {
  const rng = new Rng(seedFrom("critter:" + s.id));
  if (s.trueClass === "mirror") return mirrorSprite(rng);
  if (s.trueClass === "inert") return inertSprite(rng);
  // native: animals are flesh; everything else grows.
  return s.sample === "flesh" ? animalSprite(rng) : plantSprite(rng);
}
