// Shared Solid renderer for the core Doom-fire (used by the camp Hearth, and
// available to the intro Hearth). Ticks the field and paints a coloured <pre>;
// monospace inherited from the parent stage so 1 char = 1 cell.

import { onMount, onCleanup, createSignal, type JSX } from "solid-js";
import { Rng, seedFrom } from "../rng";
import { makeDoomFire, stepDoomFire, setSourceBand, fireGlyph, fireColor } from "../core/doomfire";

function hex(c: number): string {
  return "#" + (c & 0xffffff).toString(16).padStart(6, "0");
}

export function DoomFire(props: {
  w: number;
  h: number;
  tickMs?: number;
  source?: number; // 0..1 source strength (a dying Hearth dims it); default 1
  bandFrac?: number; // fraction of width that burns at the base; default 0.55
  class?: string;
  style?: JSX.CSSProperties;
}) {
  const [html, setHtml] = createSignal("");

  onMount(() => {
    const fire = makeDoomFire(props.w, props.h);
    const rng = new Rng(seedFrom("doomfire"));

    const band = props.bandFrac ?? 0.55;
    const paint = () => {
      // Re-seed a flickering central band each tick → a living plume that
      // tapers upward, not a saturated rectangle.
      const strength = (props.source ?? 1) * (0.82 + 0.18 * rng.nextFloat());
      setSourceBand(fire, strength, band);
      stepDoomFire(fire, rng);
      const lines: string[] = [];
      for (let y = 0; y < props.h; y++) {
        let line = "";
        let run = "";
        let runCol = -1;
        const flush = () => {
          if (run === "") return;
          line += `<span style="color:${hex(runCol)}">${run}</span>`;
          run = "";
        };
        for (let x = 0; x < props.w; x++) {
          const lvl = fire.cells[y * props.w + x];
          const col = lvl <= 0 ? -1 : fireColor(lvl);
          if (col !== runCol) {
            flush();
            runCol = col;
          }
          run += lvl <= 0 ? " " : fireGlyph(lvl);
        }
        flush();
        lines.push(line);
      }
      setHtml(lines.join("\n"));
    };

    const id = window.setInterval(paint, props.tickMs ?? 90);
    onCleanup(() => clearInterval(id));
  });

  return <pre class={props.class} style={props.style} innerHTML={html()} />;
}
