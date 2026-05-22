// The Cinder battle, as a Solid/CSS scene (plan §3). Mirrors TideEncounter's
// lifecycle. The engine (core/battle) is fully numeric; this component shows
// ONLY felt language + abstracted gauges — every value passes through
// core/battle-felt. No digit, %, level, or HP ever reaches the DOM.

import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { render as petartRender, partsForName, canonStage, HUE_COLOR, type Mood } from "../../core/petart";
import { isAlive } from "../../core/cinder";
import { applyEncounterOutcome, currentStage, type RunState } from "../../core/run";
import { finishEncounter } from "../../core/encounter-bus";
import type { MapNode } from "../../core/routemap";
import {
  startBattle,
  step,
  finalizeBattle,
  statProfile,
  canAfford,
  type BattleState,
  type Combatant,
  type TurnEvent,
  type BattleSource,
} from "../../core/battle";
import {
  coherenceFelt,
  pressFelt,
  scatterFelt,
  moveFelt,
  orderFelt,
  captureFelt,
  condWord,
  typeWord,
  growthFelt,
  absorbFelt,
  tribeFelt,
  barFelt,
  type StatKind,
} from "../../core/battle-felt";
import { stageFlavor } from "../../core/stages";
import { InventoryDialog } from "../inventory/InventoryDialog";
// Note: away from the Hearth/bonfire a Cinder shows as its mochi ENTITY
// (petart creature), never a DoomFire flame — that look is the camp's alone.

type Phase = "setup" | "battle" | "result";

function eventFelt(e: TurnEvent): string {
  const who = e.actor === "you" ? "Your fire" : "The other fire";
  if (e.text === "switch") return "You bring out another fire.";
  if (e.text === "flee-fail") return "You can't break away.";
  if (e.text === "catch-fail") return captureFelt(false, "");
  if (e.text === "bank") return `${who} banks the embers.`;
  if (e.text === "guard") return `${who} draws in.`;
  if (e.text === "stoke") return `${who} stokes.`;
  if (e.miss) return `${who}: ${scatterFelt(false)}.`;
  if (e.effectiveness !== undefined) return `${who}: ${pressFelt(e.effectiveness)}.`;
  return `${who} acts.`;
}

export function BattleEncounter(props: { run: RunState; node: MapNode; nonce?: number; source?: BattleSource }) {
  const run = props.run;
  const s: BattleState = startBattle(run, props.node, props.nonce ?? 0, props.source ?? "grass");
  const [beat, bump] = createSignal(0, { equals: false }); // beat() = subscribe; bump() = notify after a step
  const [phase, setPhase] = createSignal<Phase>("setup");
  const [fieldIdx, setFieldIdx] = createSignal(0);
  const [staked, setStaked] = createSignal(false);
  const [selMove, setSelMove] = createSignal(0);
  const [switching, setSwitching] = createSignal(false);
  const [log, setLog] = createSignal<string[]>([]);
  const [resultMsg, setResultMsg] = createSignal("");
  const [tick, setTick] = createSignal(0); // animates the entity sprites
  const [itemOpen, setItemOpen] = createSignal(false);

  function pushLogFrom(len: number): void {
    if (s.log.length <= len) return;
    const add = s.log.slice(len).map(eventFelt).filter((t) => t.length > 0);
    setLog([...log(), ...add].slice(-4));
  }

  function resolveEnd(): void {
    const lead = s.you[s.activeYou];
    const lvl0 = lead ? lead.cinder.level : 0;
    const sk0 = lead ? lead.cinder.skills.length : 0;
    const out = finalizeBattle(s, run, staked());
    applyEncounterOutcome(run, out);
    const r = s.result;
    const grew = lead && lead.cinder.level > lvl0
      ? " " + growthFelt("sharper", lead.cinder.name)
      : "";
    const took = lead && lead.cinder.skills.length > sk0
      ? " " + absorbFelt(lead.cinder.name)
      : "";
    // Warn before the wipe: the blow landed, the tribe survives but is failing.
    const tf = tribeFelt(run.campIntegrity);
    const warn = run.outcome === "running" && tf.low
      ? ` The camp can take little more — ${tf.word}.`
      : "";
    setResultMsg(
      (r === "captured"
        ? captureFelt(true, s.setup.captureName)
        : r === "win"
          ? `${s.setup.foeName} yields.`
          : r === "fled"
            ? "You break away into the dark."
            : r === "walked"
              ? "You walk on."
              : staked()
                ? "Your staked fire is snuffed. The tribe gives a fresh ember."
                : `You concede to ${s.setup.foeName}.`) + grew + took + warn,
    );
    setPhase("result");
  }

  function act(a: Parameters<typeof step>[2]): void {
    if (s.done) return;
    const len = s.log.length;
    step(s, run, a);
    pushLogFrom(len);
    bump(0);
    if (s.done) resolveEnd();
  }

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (phase() === "result") {
        if (k === "enter") { e.preventDefault(); finishEncounter(); }
        return;
      }
      if (itemOpen()) {
        if (k === "escape" || k === "i") { e.preventDefault(); setItemOpen(false); return; }
        if (k === "1") {
          e.preventDefault();
          act({ type: "useItem", item: "restorative" });
          setItemOpen(false);
          return;
        }
        return;
      }
      if (k === "i") { e.preventDefault(); setItemOpen(true); return; }
      if (phase() === "setup") {
        if (k === "escape") { e.preventDefault(); s.result = "walked"; s.done = true; resolveEnd(); return; }
        if (k === "s") { e.preventDefault(); setStaked(!staked()); return; }
        if (k >= "1" && k <= "9") {
          e.preventDefault(); // own the digit so the browser's find never sees it
          const i = Number(k) - 1;
          if (i < s.you.length) { setFieldIdx(i); s.activeYou = i; bump(0); }
          return;
        }
        if (k === "enter" || k === " ") { e.preventDefault(); setPhase("battle"); return; }
        return;
      }
      // battle
      if (switching()) {
        if (k >= "1" && k <= "9") {
          e.preventDefault();
          const i = Number(k) - 1;
          if (i < s.you.length) { act({ type: "switch", idx: i }); setSwitching(false); }
        }
        if (k === "escape") setSwitching(false);
        return;
      }
      if (k === "f") { e.preventDefault(); setSwitching(true); return; }
      if (k === "c" && s.setup.canCapture && !s.triedCatch) { e.preventDefault(); act({ type: "catch" }); return; }
      if (k === "escape") { e.preventDefault(); act({ type: "flee" }); return; }
      const me = s.you[s.activeYou];
      if (k === "arrowleft") { e.preventDefault(); setSelMove((selMove() + me.loadout.length - 1) % me.loadout.length); return; }
      if (k === "arrowright") { e.preventDefault(); setSelMove((selMove() + 1) % me.loadout.length); return; }
      if (k >= "1" && k <= "9") {
        e.preventDefault();
        const i = Number(k) - 1;
        if (i < me.loadout.length) act({ type: "move", moveId: me.loadout[i].id });
        return;
      }
      if (k === "enter" || k === " ") {
        e.preventDefault();
        act({ type: "move", moveId: me.loadout[selMove()].id });
      }
    }
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  onMount(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 160);
    onCleanup(() => clearInterval(id));
  });

  const me = () => { beat(); return s.you[s.activeYou]; };
  const foe = () => { beat(); return s.foe; };

  // A Cinder shown as its mochi creature (not a flame): stage from its growth,
  // mood from its battle state, coloured by its rolled hue. The bonfire/camp
  // is the only place a Cinder is drawn as literal fire.
  // `c` is the reactive accessor (me/foe). Calling c() reads `beat()`, so every
  // memo here re-tracks when bump() fires after a step() — bar/sprite update.
  function CinderSprite(p: { c: () => Combatant }) {
    const parts = () => partsForName(p.c().cinder.name);
    // Same art everywhere: one fixed stage; idle while it burns; the smoke
    // frame once it's out (KO'd this battle or snuffed). No damage/status
    // reactions — that, and evolution, is TBD.
    const mood = (): Mood => {
      const cc = p.c();
      return cc.down || cc.coherence <= 0 || !isAlive(cc.cinder) ? "dead" : "idle";
    };
    const frames = () => petartRender(canonStage(p.c().cinder), parts())[mood()];
    const frame = () => {
      const f = frames();
      return f[tick() % f.length];
    };
    const col = () => "#" + ((HUE_COLOR[parts().hue] ?? 0xffaa44) >>> 0).toString(16).padStart(6, "0");
    return <pre class="bt-sprite" style={{ color: col() }}>{frame().join("\n")}</pre>;
  }

  function Gauge(p: { c: () => Combatant; label: string }) {
    const frac = () => {
      const cc = p.c();
      return Math.max(0, Math.min(1, cc.coherence / Math.max(1, cc.maxCoherence)));
    };
    const cf = () => coherenceFelt(frac());
    return (
      <div class="bt-coh">
        <span class="bt-coh-name">{p.label}</span>
        {/* An abstracted coherence bar (no numbers) — moves on every hit so
            damage is always legible; the felt word names the band. */}
        <span class="bt-coh-bar">
          <span
            class="bt-coh-fill"
            classList={{ grave: cf().grave }}
            style={{ width: `${(frac() * 100).toFixed(1)}%` }}
          />
        </span>
        <span class="bt-coh-word" classList={{ grave: cf().grave }}>{cf().word}</span>
        <span class="bt-states">
          <For each={p.c().conds}>{(a) => <span class="bt-state">{condWord(a.cond)}</span>}</For>
        </span>
      </div>
    );
  }

  // The breath / mana gauge — vitality is the spendable battle budget now, so
  // it gets its own prominent bar beside Coherence (both fires), felt only.
  // Reactive via the same p.c() → beat() path; drains as skills are cast.
  function VitalityGauge(p: { c: () => Combatant }) {
    const frac = () => {
      const cc = p.c();
      return Math.max(0, Math.min(1, cc.cinder.vitality));
    };
    const vf = () => barFelt(frac(), "vitality");
    const grave = () => frac() < 0.18;
    return (
      <div class="bt-vit">
        <span class="bt-vit-name">breath</span>
        <span class="bt-vit-bar">
          <span
            class="bt-vit-fill"
            classList={{ grave: grave() }}
            style={{ width: `${(frac() * 100).toFixed(1)}%` }}
          />
        </span>
        <span class="bt-vit-word" classList={{ grave: grave() }}>{vf().word}</span>
      </div>
    );
  }

  // The live felt stat bars (DESIGN.md §1.4 — bands + word, never a number).
  // Coherence + the breath/mana gauge are the two big gauges; these four read
  // off statProfile and re-track via p.c() → beat(). (Vitality is no longer a
  // row here — it has its own prominent VitalityGauge beside Coherence.)
  const STAT_ROWS: Array<[string, StatKind]> = [
    ["bite", "power"],
    ["eye", "keenness"],
    ["hold", "resilience"],
    ["speed", "initiative"],
  ];
  function StatBars(p: { c: () => Combatant }) {
    const prof = () => {
      const cc = p.c();
      return statProfile(cc.cinder, cc.maxCoherence > 0 ? cc.coherence / cc.maxCoherence : 0);
    };
    return (
      <div class="bt-stats">
        <For each={STAT_ROWS}>
          {(row) => {
            const bf = () => barFelt(prof()[row[1]], row[1]);
            return (
              <div class="bt-stat">
                <span class="bt-stat-name">{row[0]}</span>
                <span class="bt-stat-cells">
                  <For each={[0, 1, 2, 3, 4, 5]}>
                    {(i) => <span class="bt-stat-cell" classList={{ on: i < bf().cells }} />}
                  </For>
                </span>
                <span class="bt-stat-word">{bf().word}</span>
              </div>
            );
          }}
        </For>
      </div>
    );
  }

  return (
    <div class="enc-root">
      <div class="enc-stage">
        <p class="enc-title">A CINDER BATTLE</p>
        <p class="enc-sub">
          {currentStage(run)} — {
            s.setup.kind === "rival" ? "a rival and their Cinder bar the way"
              : s.setup.kind === "peer" ? "a peer and their Cinder stand against you"
              : (props.source ?? "grass") === "rubble" ? "a wild fire stirs in the rubble"
              : "a wild fire flares from the brush"
          }
        </p>
        <Show when={stageFlavor(run).length > 0}>
          <p class="enc-sub" style={{ "font-style": "italic", opacity: 0.75 }}>
            {stageFlavor(run)}
          </p>
        </Show>
        <p class="enc-tribe" classList={{ "is-low": tribeFelt(run.campIntegrity).low }}>
          {tribeFelt(run.campIntegrity).word}
        </p>

        <Show when={phase() === "setup"}>
          <p class="enc-dim">Field which fire? (number) · [S] stake: <b>{staked() ? "yes — a loss snuffs it" : "no"}</b></p>
          <div class="bt-roster">
            <For each={s.you}>
              {(c, i) => (
                <button
                  class="bt-fire"
                  classList={{ sel: i() === fieldIdx() }}
                  onClick={() => { setFieldIdx(i()); s.activeYou = i(); bump(0); }}
                >
                  {c.cinder.name}{c.cinder.bonded ? " (bonded)" : ""}
                </button>
              )}
            </For>
          </div>
          <p class="enc-keys">
            <button class="bt-btn" onClick={() => setStaked(!staked())}>[S] stake</button>
            <button class="bt-btn" onClick={() => setPhase("battle")}>[Enter] face them</button>
            <button class="bt-btn" onClick={() => { s.result = "walked"; s.done = true; resolveEnd(); }}>[Esc] walk away</button>
          </p>
        </Show>

        <Show when={phase() === "battle"}>
          <div class="enc-body">
            <div class="bt-side">
              <div class="enc-fire">
                <CinderSprite c={me} />
              </div>
              <Gauge c={me} label={me().cinder.name} />
              <VitalityGauge c={me} />
              <StatBars c={me} />
            </div>
            <div class="bt-mid">
              <p class="bt-order">{orderFelt("cross")}</p>
              <div class="bt-log">
                <For each={log()}>{(t, i) => <p classList={{ "enc-band": true, "is-latest": i() === log().length - 1 }}>{t}</p>}</For>
              </div>
            </div>
            <div class="bt-side">
              <div class="enc-fire">
                <CinderSprite c={foe} />
              </div>
              <Gauge c={foe} label={s.setup.foeName} />
              <VitalityGauge c={foe} />
              <StatBars c={foe} />
            </div>
          </div>

          <Show when={!switching()} fallback={
            <div class="bt-moves">
              <p class="enc-dim">Bring out which fire? (number) · [Esc] cancel</p>
              <For each={s.you}>
                {(c, i) => (
                  <button class="bt-move" disabled={c.down || i() === s.activeYou} onClick={() => { act({ type: "switch", idx: i() }); setSwitching(false); }}>
                    {c.cinder.name}{c.down ? " (out)" : ""}
                  </button>
                )}
              </For>
            </div>
          }>
            <div class="bt-moves">
              <For each={me().loadout}>
                {(mv, i) => {
                  const afford = () => canAfford(me(), mv); // re-tracks via me()→beat()
                  return (
                  <button
                    class="bt-move"
                    classList={{ sel: i() === selMove(), "bt-unaffordable": !afford() }}
                    disabled={!afford()}
                    onMouseEnter={() => setSelMove(i())}
                    onClick={() => { if (afford()) act({ type: "move", moveId: mv.id }); }}
                  >
                    <span class="bt-move-name">{mv.name}</span>
                    <span class="bt-move-sub">{mv.desc}</span>
                    <span class="bt-move-sub">
                      {afford() ? `${typeWord(mv.type)} · ${moveFelt(mv).reliability} · ${moveFelt(mv).cost}` : "no breath for it"}
                    </span>
                  </button>
                  );
                }}
              </For>
            </div>
          </Show>
          <p class="enc-keys">
            [1-4] technique &nbsp; [F] switch fire &nbsp;
            <span classList={{ "enc-dim": (beat(), !s.setup.canCapture || s.triedCatch) }}>
              {(beat(), !s.setup.canCapture
                ? "[C] — only a wild fire can be kindled"
                : s.triedCatch
                  ? "[C] — the ember won't be drawn twice"
                  : "[C] take the ember")}
            </span>
            &nbsp; [Esc] flee
          </p>
        </Show>

        <Show when={phase() === "result"}>
          <p class="bt-result">{resultMsg()}</p>
          <p class="enc-keys"><button class="bt-btn" onClick={() => finishEncounter()}>[Enter] go on</button></p>
        </Show>

        <p class="enc-dim">the fire never speaks in numbers — weigh it yourself</p>
      </div>
      <Show when={itemOpen()}>
        <InventoryDialog
          run={run}
          usableOnly
          onClose={() => setItemOpen(false)}
          onUseRestorative={() => {
            act({ type: "useItem", item: "restorative" });
            setItemOpen(false);
          }}
        />
      </Show>
    </div>
  );
}
