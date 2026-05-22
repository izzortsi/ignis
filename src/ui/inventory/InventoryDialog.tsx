import { For, Show } from "solid-js";
import type { RunState } from "../../core/run";
import { tribeFelt } from "../../core/battle-felt";

export function InventoryDialog(props: {
  run: RunState;
  onClose: () => void;
  usableOnly?: boolean;
  onUseRestorative?: () => void;
  onUseCache?: () => void;
}) {
  const inv = () => props.run.inventory;
  const relics = () => props.run.meta.relics ?? [];
  const usableOnly = () => props.usableOnly === true;
  return (
    <div class="title-dex" onClick={() => props.onClose()}>
      <div class="title-dex-panel" onClick={(e) => e.stopPropagation()}>
        <h2 class="title-dex-h">{usableOnly() ? "ITEMS" : "INVENTORY"}</h2>

        <Show
          when={!usableOnly()}
          fallback={
            <div class="title-dex-cols">
              <div class="title-dex-col">
                <p class="title-dex-cap">usable now</p>
                <Show
                  when={inv().restoratives > 0}
                  fallback={<p class="title-dex-none">— no usable items —</p>}
                >
                  <button class="camp-fire-act" onClick={() => props.onUseRestorative?.()}>
                    [1] restorative <span class="title-dex-dim">· restores breath</span>
                  </button>
                  <p class="title-dex-dim">held: {inv().restoratives}</p>
                </Show>
              </div>
            </div>
          }
        >
          <div class="title-dex-cols">
            <div class="title-dex-col">
              <p class="title-dex-cap">supplies</p>
              <p>caches <span class="title-dex-dim">· {inv().caches}</span></p>
              <p>restoratives <span class="title-dex-dim">· {inv().restoratives}</span></p>
              <Show when={props.onUseCache && inv().caches > 0}>
                <button class="camp-fire-act" onClick={() => props.onUseCache?.()}>
                  spend cache
                </button>
              </Show>
            </div>
            <div class="title-dex-col">
              <p class="title-dex-cap">relics ({relics().length})</p>
              <Show when={relics().length > 0} fallback={<p class="title-dex-none">— none yet —</p>}>
                <For each={relics()}>
                  {(r) => <p>{r}</p>}
                </For>
              </Show>
            </div>
          </div>
          <p class="title-dex-cap">the tribe</p>
          <p
            classList={{
              "is-low": tribeFelt(props.run.campIntegrity).low,
            }}
          >
            {tribeFelt(props.run.campIntegrity).word}
            {tribeFelt(props.run.campIntegrity).low ? " — it can take little more" : ""}
          </p>
        </Show>

        <p class="title-hint">{usableOnly() ? "[1] use · esc / i close" : "esc / i / click away to close"}</p>
      </div>
    </div>
  );
}
