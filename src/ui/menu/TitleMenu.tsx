// The main menu — a real Solid + CSS screen (replaces the ASCII scenes/title.ts
// that went through Game's <pre> scale-transform and stretched on any non-96:36
// viewport). Flexbox-centred, rem-sized — there is no fixed grid to distort.
// Keyboard (↑/↓ + Enter, D, Esc) and mouse both work, matching the rest of the
// migrated Solid scenes (IntroScene / CampScene pattern).

import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { loadMeta, hasMemory } from "../../core/run";
import { FLASHBACKS } from "../../core/flashback";
import { FLASH_ART, flashThumb } from "../flashArt";

const TAGLINE = "a roguelite of fire, chirality, and the long walk south";
const EMBER = [".", ":", "*", "o", "*", ":"]; // the old title spinner, kept

export function TitleMenu(props: { onBegin: () => void }) {
  const [sel, setSel] = createSignal(0);
  const [tick, setTick] = createSignal(0);
  const [dexOpen, setDexOpen] = createSignal(false);
  const meta = loadMeta();

  const items = [
    { label: "begin the rite", act: () => props.onBegin() },
    { label: "the dex", act: () => setDexOpen(true) },
  ];

  onMount(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 140);
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (dexOpen()) {
        if (k === "Escape" || k === "Enter") {
          e.preventDefault();
          setDexOpen(false);
        }
        return;
      }
      if (k === "ArrowDown" || k === "ArrowRight") {
        e.preventDefault();
        setSel((sel() + 1) % items.length);
      } else if (k === "ArrowUp" || k === "ArrowLeft") {
        e.preventDefault();
        setSel((sel() + items.length - 1) % items.length);
      } else if (k === "Enter" || k === " ") {
        e.preventDefault();
        items[sel()].act();
      } else if (k === "d" || k === "D") {
        e.preventDefault();
        setDexOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    });
  });

  const ember = () => EMBER[tick() % EMBER.length];

  return (
    <div class="title-root">
      <div class="title-card">
        <h1 class="title-heading">IGNIS</h1>
        <div class="title-ember">{ember()}</div>
        <p class="title-tagline">{TAGLINE}</p>

        <div class="title-menu">
          <For each={items}>
            {(it, i) => (
              <button
                class="title-item"
                classList={{ "is-sel": i() === sel() }}
                onMouseEnter={() => setSel(i())}
                onClick={() => it.act()}
              >
                {i() === sel() ? "» " : "  "}
                {it.label}
              </button>
            )}
          </For>
        </div>

        <p class="title-hint">↑↓ choose · enter select · the dex & memorial outlast every run</p>
      </div>

      <Show when={dexOpen()}>
        <div class="title-dex" onClick={() => setDexOpen(false)}>
          <div class="title-dex-panel" onClick={(e) => e.stopPropagation()}>
            <h2 class="title-dex-h">THE DEX</h2>
            <div class="title-dex-cols">
              <div class="title-dex-col">
                <p class="title-dex-cap">species read ({meta.dex.length})</p>
                <Show when={meta.dex.length > 0} fallback={<p class="title-dex-none">— none yet —</p>}>
                  <For each={meta.dex}>{(d) => <p>{d.species} <span class="title-dex-dim">· {d.firstSeenStage}</span></p>}</For>
                </Show>
              </div>
              <div class="title-dex-col">
                <p class="title-dex-cap">fires caught ({meta.caught.length})</p>
                <Show when={meta.caught.length > 0} fallback={<p class="title-dex-none">— none yet —</p>}>
                  <For each={meta.caught}>{(c) => <p>{c.name} <span class="title-dex-dim">· {c.stage}</span></p>}</For>
                </Show>
              </div>
              <div class="title-dex-col">
                <p class="title-dex-cap">memorial — memories recovered ({meta.memories.length}/{FLASHBACKS.length})</p>
                <div class="mem-gallery">
                  <For each={FLASHBACKS}>
                    {(fb) => (
                      <div class="mem-card" classList={{ locked: !hasMemory(meta, fb.id) }}>
                        <Show
                          when={hasMemory(meta, fb.id)}
                          fallback={<p class="mem-card-locked">— a memory not yet recovered —</p>}
                        >
                          <pre class="mem-card-art">{flashThumb(FLASH_ART[fb.id])}</pre>
                          <p class="mem-card-title">{fb.title}</p>
                          <p class="title-dex-dim">{fb.caption}</p>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
                <p class="title-dex-cap">the fallen ({meta.memorial.length})</p>
                <Show when={meta.memorial.length > 0} fallback={<p class="title-dex-none">— none yet —</p>}>
                  <For each={meta.memorial}>{(m) => <p>{m.name} <span class="title-dex-dim">· {m.stage}</span></p>}</For>
                </Show>
              </div>
            </div>
            <p class="title-hint">esc / click away to close</p>
          </div>
        </div>
      </Show>
    </div>
  );
}
