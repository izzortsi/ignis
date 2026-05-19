// Scene-side helper for painting the procedural Cinder art (src/core/petart.ts)
// onto the ASCII Screen. Art is cached by name+stage (rebuilding all moods every
// frame would be wasteful); frames cycle on wall-clock seconds for visible
// motion (blink, chew, drift, smoke-rise).

import type { Screen } from "../screen";
import type { Cinder } from "../core/cinder";
import {
  cinderArt,
  render,
  partsForName,
  stageForCinder,
  HUE_COLOR,
  type Mood,
  type Stage,
  type Frame,
} from "../core/petart";

const cache = new Map<string, Record<Mood, Frame[]>>();
const FRAME_SECONDS = 0.4;

function artForCinder(c: Cinder): Record<Mood, Frame[]> {
  const key = "c:" + c.name + "|" + stageForCinder(c);
  let a = cache.get(key);
  if (a === undefined) {
    a = cinderArt(c);
    cache.set(key, a);
  }
  return a;
}

function artForName(name: string, stage: Stage): Record<Mood, Frame[]> {
  const key = "n:" + name + "|" + stage;
  let a = cache.get(key);
  if (a === undefined) {
    a = render(stage, partsForName(name));
    cache.set(key, a);
  }
  return a;
}

export function hueOf(name: string): number {
  return HUE_COLOR[partsForName(name).hue] ?? 0xf2f0e8;
}

function frameAt(frames: Frame[], tSec: number): Frame {
  if (frames.length === 0) return [];
  return frames[Math.floor(tSec / FRAME_SECONDS) % frames.length];
}

function paint(screen: Screen, x: number, y: number, frame: Frame, color: number): void {
  for (let r = 0; r < frame.length; r++) screen.text(x, y + r, frame[r], color);
}

export function drawCinder(screen: Screen, x: number, y: number, c: Cinder, mood: Mood, tSec: number): void {
  paint(screen, x, y, frameAt(artForCinder(c)[mood], tSec), hueOf(c.name));
}

export function drawFire(
  screen: Screen,
  x: number,
  y: number,
  name: string,
  stage: Stage,
  mood: Mood,
  tSec: number,
): void {
  paint(screen, x, y, frameAt(artForName(name, stage)[mood], tSec), hueOf(name));
}
