// One leg's cave, on Solid. App owns run + route and the camp hub; Game runs
// a single LocalMapScene for the chosen route node, painting the DOM Screen
// into a <pre> each frame. Tide/Battle overlay via the encounter bus. When the
// cave is left (south exit / Esc) or the run ends inside it, Game calls
// onLegDone() and App returns you to camp (or the end screen).

import { onMount, onCleanup, createSignal, Show } from "solid-js";
import { Screen } from "./screen";
import type { Input, Scene } from "./scene";
import { LocalMapScene } from "./scenes/localmap";
import type { RunState } from "./core/run";
import type { MapNode } from "./core/routemap";
import { encounterRequest, finishEncounter } from "./core/encounter-bus";
import { TideEncounter } from "./ui/encounter/TideEncounter";
import { BattleEncounter } from "./ui/encounter/BattleEncounter";

function isGameKey(k: string): boolean {
  return (
    k.length === 1 ||
    k.startsWith("Arrow") ||
    k === "Enter" ||
    k === "Backspace" ||
    k === "Escape" ||
    k === "Tab"
  );
}

export function Game(props: { run: RunState; node: MapNode; onLegDone: () => void }) {
  const [html, setHtml] = createSignal("");
  let preRef!: HTMLPreElement;

  onMount(() => {
    // A fresh leg must never inherit a stale encounter request (the bus is a
    // module singleton); a leftover one would pause the loop -> blank screen.
    finishEncounter();
    const screen = new Screen(96, 36);
    const stack: Scene[] = [new LocalMapScene(props.run, props.node)];
    const pressed = new Set<string>();

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isGameKey(e.key)) e.preventDefault();
      if (e.repeat) return;
      pressed.add(e.key);
    };
    window.addEventListener("keydown", onKey);

    let last = performance.now();
    let raf = 0;
    let stopped = false;

    const done = () => {
      if (stopped) return;
      stopped = true;
      window.removeEventListener("keydown", onKey);
      props.onLegDone();
    };

    const frame = (now: number) => {
      if (stopped) return;
      if (encounterRequest() !== null) {
        last = now;
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      try {
        const input: Input = { pressed, resized: false };
        const top = stack[stack.length - 1];
        const cmd = top.update(dt, input);

        if (cmd.kind === "quit") {
          done();
          return;
        }
        switch (cmd.kind) {
          case "replace":
            stack[stack.length - 1] = cmd.next;
            break;
          case "push":
            stack.push(cmd.next);
            break;
          case "pop":
            if (stack.length > 1) stack.pop();
            else {
              done(); // left the cave (south exit / Esc) → back to camp
              return;
            }
            break;
          case "none":
            break;
        }

        // The run can end inside the leg (tribe-wiped in an encounter).
        if (props.run.outcome !== "running") {
          done();
          return;
        }

        if (stack.length > 0) {
          screen.clear();
          stack[stack.length - 1].render(screen);
          setHtml(screen.toHTML());
        }
      } catch (err) {
        console.error("[game loop]", err);
      }
      pressed.clear();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Letterbox the 96x36 grid to the window (non-uniform scale, from font
    // metrics so it's correct before the first paint).
    const BASE_PX = 16; // must match .game-screen font-size
    const fit = () => {
      const el = preRef;
      if (!el) return;
      const probe = document.createElement("span");
      probe.style.cssText =
        "position:absolute;visibility:hidden;white-space:pre;" +
        `font:${BASE_PX}px ui-monospace,"DejaVu Sans Mono","Courier New",monospace`;
      probe.textContent = "MMMMMMMMMMMMMMMMMMMM"; // 20 chars
      document.body.appendChild(probe);
      const charW = probe.getBoundingClientRect().width / 20;
      document.body.removeChild(probe);
      if (charW < 0.1) return;
      const natW = 96 * charW;
      const natH = 36 * BASE_PX;
      el.style.transform = `scale(${window.innerWidth / natW}, ${window.innerHeight / natH})`;
    };
    fit();
    requestAnimationFrame(fit);
    window.addEventListener("resize", fit);

    onCleanup(() => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
      finishEncounter();
    });
  });

  return (
    <div class="game-shell">
      <pre ref={preRef} class="game-screen" innerHTML={html()} />
      <Show when={encounterRequest()}>
        {(r) =>
          r().kind === "tide" ? (
            <TideEncounter run={r().run} />
          ) : r().kind === "battle" ? (
            <BattleEncounter run={r().run} node={r().node!} nonce={r().nonce ?? 0} />
          ) : null
        }
      </Show>
    </div>
  );
}
