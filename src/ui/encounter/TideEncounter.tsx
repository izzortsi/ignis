// The Tide Defense encounter, as a Solid/CSS scene (replaces the ASCII
// TideScene). Same core logic (core/tide) and outcome (applyEncounterOutcome)
// faithfully ported: read with the bonded fire (R, repeatable = joint), then
// pass (E) / burn (B) / quarantine (Q). The truth is never shown — only the
// camp bar moves. A live Hearth burns beside the sample.

import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { sharpness, spectralFit, type Band } from "../../core/reading";
import { bondedCinder, applyEncounterOutcome, currentStage, stageConditions, type RunState } from "../../core/run";
import { fireVoice } from "../../core/fireVoice";
import { readProfile, cinderStage, xpProgress, isBurnBright } from "../../core/cinder";
import { tribeFelt } from "../../core/battle-felt";
import { stageFlavor } from "../../core/stages";
import { makeEncounter, current, readCurrent, decide, tideOutcome, type TideEncounter as Tide } from "../../core/tide";
import { speciesByName } from "../../core/bestiary";
import { critterSprite } from "../../core/critterart";
import { finishEncounter } from "../../core/encounter-bus";
import { DoomFire } from "../DoomFire";
import { InventoryDialog } from "../inventory/InventoryDialog";
import { useRestorative } from "../../core/inventory";

export function TideEncounter(props: { run: RunState }) {
  const run = props.run;
  const tide: Tide = makeEncounter(run);
  const [, bump] = createSignal(0, { equals: false }); // force re-render on action
  const [bands, setBands] = createSignal<string[]>([]);
  const [itemOpen, setItemOpen] = createSignal(false);

  function useRestorativeItem(): void {
    if (useRestorative(run.inventory)) {
      const fire = bondedCinder(run);
      fire.vitality = Math.min(1, fire.vitality + 0.5);
      bump(0);
    }
    setItemOpen(false);
  }

  function finishIfDone(): boolean {
    if (tide.finished) {
      applyEncounterOutcome(run, tideOutcome(tide));
      finishEncounter();
      return true;
    }
    return false;
  }

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (tide.finished) return;
      if (itemOpen()) {
        if (k === "escape" || k === "i") { e.preventDefault(); setItemOpen(false); return; }
        if (k === "1") { e.preventDefault(); useRestorativeItem(); return; }
        return;
      }
      if (k === "i") { e.preventDefault(); setItemOpen(true); return; }
      const ent = current(tide);
      if (ent === undefined) {
        tide.finished = true;
        finishIfDone();
        return;
      }
      if (k === "r") {
        e.preventDefault();
        const band = readCurrent(tide, run, bondedCinder(run));
        setBands([...bands(), band]);
        return;
      }
      if (k === "e" || k === "b" || k === "q") {
        e.preventDefault();
        decide(tide, run, k === "e" ? "pass" : k === "b" ? "burn" : "quarantine");
        setBands([]);
        if (!finishIfDone()) bump(0);
      }
    }
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  const ent = () => current(tide);
  const integrity = () => Math.max(0, run.campIntegrity - tide.campDamage);

  // Fielded-fire RPG sheet. bands() is read first so these recompute after
  // every read/decide (vitality, level, sharpness shift live).
  const fire = () => {
    bands();
    return bondedCinder(run);
  };
  const prof = () => readProfile(fire());
  const xpp = () => xpProgress(fire());
  const fitPct = () => {
    bands();
    const e = ent();
    return e ? Math.round(spectralFit(fire().spectral, e.sample) * 100) : 0;
  };
  const sharpPct = () => {
    bands();
    const e = ent();
    return e ? Math.round(sharpness(prof(), stageConditions(run, e.sample)) * 100) : 0;
  };

  return (
    <div class="enc-root">
      <div class="enc-stage">
        <p class="enc-title">AN ENCOUNTER</p>
        <p class="enc-sub">{currentStage(run)} — something crosses your path</p>
        <Show when={stageFlavor(run).length > 0}>
          <p class="enc-sub" style={{ "font-style": "italic", opacity: 0.75 }}>
            {stageFlavor(run)}
          </p>
        </Show>

        <div class="enc-bar">
          <span classList={{ "is-low": tribeFelt(integrity()).low }}>{tribeFelt(integrity()).word}</span>
          <span class="enc-bar-track">
            <span
              class="enc-bar-fill"
              style={{
                width: `${Math.round(integrity() * 100)}%`,
                background: tribeFelt(integrity()).low ? "#e85656" : "#78aaff",
              }}
            />
          </span>
        </div>

        <div class="enc-sheet">
          <p>
            <span class="enc-fire-name">{fire().name}</span>
            <span class="enc-dim">
              {" · "}{cinderStage(fire())} · Lv {xpp().level}
              {isBurnBright(fire()) ? " · burn-bright" : ""}
            </span>
          </p>
          <div class="enc-statline">
            <span>vit {Math.round(fire().vitality * 100)}%</span>
            <span>acuity {Math.round(prof().baseAcuity * 100)}</span>
            <span>{fire().manner}</span>
            <span>{fire().spectral}</span>
            <span>xp {xpp().xp}/{xpp().need}</span>
          </div>
          <Show when={ent()}>
            <div class="enc-statline enc-odds">
              <span>vs {ent()!.sample}: spectral fit {fitPct()}%</span>
              <span>read sharpness {sharpPct()}%</span>
            </div>
          </Show>
        </div>

        <Show when={ent()} fallback={<p class="enc-sub">The tide settles.</p>}>
          {(e) => (
            <div class="enc-body">
              <div class="enc-fire">
                <DoomFire w={14} h={12} bandFrac={0.5} />
              </div>
              <div class="enc-sample">
                <p class="enc-dim">Brought to the fire:</p>
                <p class="enc-species">{e().species}</p>
                <p class="enc-dim">a sample of {e().sample}</p>
                <pre class="enc-critter">{(speciesByName(e().species) ? critterSprite(speciesByName(e().species)!) : []).join("\n")}</pre>
              </div>
              <div class="enc-verdict">
                <p class="enc-dim">The fire says:</p>
                <Show when={bands().length > 0} fallback={<p class="enc-dim">— press R to read it —</p>}>
                  <For each={bands()}>
                    {(b, i) => (
                      <p classList={{ "enc-band": true, "is-latest": i() === bands().length - 1 }}>
                        {fireVoice(bondedCinder(run), "read-band", { band: b as Band })}
                      </p>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          )}
        </Show>

        <p class="enc-keys">[R] read again (joint) &nbsp; [E] let pass &nbsp; [B] burn &nbsp; [Q] quarantine</p>
        <p class="enc-dim">the fire never speaks in numbers — weigh it yourself</p>
      </div>
      <Show when={itemOpen()}>
        <InventoryDialog
          run={run}
          usableOnly
          onClose={() => setItemOpen(false)}
          onUseRestorative={useRestorativeItem}
        />
      </Show>
    </div>
  );
}
