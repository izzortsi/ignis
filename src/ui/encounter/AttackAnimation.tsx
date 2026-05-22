// Per-attack animation overlay (DESIGN: skills feel real, audacious).
// SIMPLIFIED: drop the queue + sequential state machine. Each actor gets
// independent trail/burst slots. When a step() pushes both actors' events,
// they animate IN PARALLEL from opposite sides — the player's "you" trail
// travels left→right, the foe's travels right→left. They cross mid-screen
// but originate from clearly distinct sides, so the visual reads as a
// contest, not two overlapping glyphs.
//
// Visual vocabulary per WheelType:
//   - entropy:    a single bold * — explodes on impact (@)
//   - negentropy: a clean line —
//   - noise:      scattered #
//   - signal:     a beam =
//
// Each event triggers fire-and-forget setTimeout chains. No queue means no
// queue-interaction bugs. The seq counter guards against stale timers
// firing after a newer event has overwritten a slot.

import { Show, createSignal, createEffect, onCleanup } from "solid-js";
import type { TurnEvent, WheelType } from "../../core/battle";

const TRAVEL_MS = 280;
const EXPLODE_MS = 220;

interface Visual {
  trail: string;
  burst: string | null;
  cls: string;
}

const VISUAL: Record<WheelType, Visual> = {
  entropy:    { trail: "*", burst: "@",  cls: "atk-entropy" },
  negentropy: { trail: "—", burst: null, cls: "atk-negentropy" },
  noise:      { trail: "#", burst: null, cls: "atk-noise" },
  signal:     { trail: "=", burst: null, cls: "atk-signal" },
};

function isAnimatable(e: TurnEvent): boolean {
  if (e.moveType === undefined) return false;
  return e.text === "press" || e.text === "feint" || e.text === "joint" || e.text === "scatter";
}

interface TrailSlot { visual: Visual; miss: boolean; seq: number; }
interface BurstSlot { visual: Visual; seq: number; }

export function AttackAnimation(props: {
  events: () => TurnEvent[];
  onHit?: (target: "you" | "foe") => void;
}) {
  // Four independent slots — two trails (one per actor), two bursts.
  // Each clears itself via its own setTimeout chain, gated by seq match
  // so stale timers can't clobber a newer animation.
  const [youTrail, setYouTrail] = createSignal<TrailSlot | null>(null);
  const [foeTrail, setFoeTrail] = createSignal<TrailSlot | null>(null);
  const [youBurst, setYouBurst] = createSignal<BurstSlot | null>(null);
  const [foeBurst, setFoeBurst] = createSignal<BurstSlot | null>(null);

  let cursor = 0;
  let seqCounter = 0;
  const timers = new Set<number>();

  function startTimer(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  function fire(e: TurnEvent): void {
    if (e.moveType === undefined) return;
    const visual = VISUAL[e.moveType];
    const mySeq = ++seqCounter;
    const miss = e.miss === true;

    if (e.actor === "you") {
      setYouTrail({ visual, miss, seq: mySeq });
      startTimer(() => {
        // Travel done. Clear the trail (if still ours), spawn the burst
        // (entropy moves only, hits only), fire the hit flash on the foe.
        const cur = youTrail();
        if (cur && cur.seq === mySeq) setYouTrail(null);
        if (!miss) {
          if (visual.burst !== null) {
            setYouBurst({ visual, seq: mySeq });
            startTimer(() => {
              const b = youBurst();
              if (b && b.seq === mySeq) setYouBurst(null);
            }, EXPLODE_MS);
          }
          props.onHit?.("foe");
        }
      }, TRAVEL_MS);
    } else {
      setFoeTrail({ visual, miss, seq: mySeq });
      startTimer(() => {
        const cur = foeTrail();
        if (cur && cur.seq === mySeq) setFoeTrail(null);
        if (!miss) {
          if (visual.burst !== null) {
            setFoeBurst({ visual, seq: mySeq });
            startTimer(() => {
              const b = foeBurst();
              if (b && b.seq === mySeq) setFoeBurst(null);
            }, EXPLODE_MS);
          }
          props.onHit?.("you");
        }
      }, TRAVEL_MS);
    }
  }

  createEffect(() => {
    // Walk the log from cursor to end on every beat. Each new animatable
    // event fires its own independent animation slot. No queue, no
    // sequencing — both actors' events from a step() animate in parallel.
    const log = props.events();
    while (cursor < log.length) {
      const e = log[cursor];
      cursor += 1;
      if (isAnimatable(e)) fire(e);
    }
  });

  onCleanup(() => {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  });

  return (
    <div class="atk-layer">
      <Show when={youTrail()}>
        {(t) => (
          <span
            class={`atk-trail ${t().visual.cls}`}
            classList={{ "atk-miss": t().miss }}
          >
            {t().visual.trail}
          </span>
        )}
      </Show>
      <Show when={foeTrail()}>
        {(t) => (
          <span
            class={`atk-trail ${t().visual.cls} atk-reverse`}
            classList={{ "atk-miss": t().miss }}
          >
            {t().visual.trail}
          </span>
        )}
      </Show>
      <Show when={youBurst()}>
        {(b) => (
          <span class={`atk-burst ${b().visual.cls}`}>{b().visual.burst}</span>
        )}
      </Show>
      <Show when={foeBurst()}>
        {(b) => (
          <span class={`atk-burst ${b().visual.cls} atk-reverse`}>{b().visual.burst}</span>
        )}
      </Show>
    </div>
  );
}
