// The cave / chapada — a leg's walkable map, now Solid + CSS (replaces the
// ASCII LocalMapScene through Game's stretched <pre>). Pure logic reused
// unchanged from core/localmap (makeLocalMap / computeVisible / tryMove /
// siteAt). Camp colour palette, a soft Cinder-light falloff whose reach scales
// with the bonded fire, and the Cinder trailing one step behind. Encounters
// (grass→battle, water→tide, sites) are raised on the shared bus; App mounts
// the Solid encounter over this scene and we resume when it clears.

import { createSignal, createMemo, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import {
  makeLocalMap, computeVisible, tryMove, siteAt,
  canSeeFrom, stepToward, spawnDuelSite,
  biomeOf, type Tile, type EncounterSite,
} from "../../core/localmap";
import {
  applySpoils, tendFires, currentStage, recoverMemoryInRun, type RunState,
} from "../../core/run";
import { stageFlavor, stageEncounterMul } from "../../core/stages";
import { unrecoveredFlashbacks } from "../../core/flashback";
import { rollRuin } from "../../core/ruin";
import type { MapNode } from "../../core/routemap";
import { isAlive, isBurnBright, gainXp } from "../../core/cinder";
import { addCache, addRestorative, useCache } from "../../core/inventory";
import { Rng, seedFrom } from "../../rng";
import { requestEncounter, encounterRequest } from "../../core/encounter-bus";
import { CINDER_FOLLOW } from "../../screen";
import { InventoryDialog } from "../inventory/InventoryDialog";

const BIOME_PHRASE: Record<string, string> = {
  forest: "wooded foothills", coast: "the coast", ruins: "glassed ruins",
  desert: "open sand", mountain: "a mountain ledge", jungle: "deep green",
  isthmus: "a narrow neck of land", alpine: "thin air, high peaks",
};
const SITE: Record<string, { ch: string; cls: string }> = {
  duel: { ch: "D", cls: "cave-duel" },
  forage: { ch: "&", cls: "cave-forage" },
  ruin: { ch: "?", cls: "cave-ruin" },
  camp: { ch: "H", cls: "cave-camp" },
};
const TILE: Record<Tile, { ch: string; cls: string } | null> = {
  floor: { ch: "·", cls: "t-floor" },
  wall: { ch: "#", cls: "t-wall" },
  cliff: null, // the drop — void
  exit: { ch: "v", cls: "t-exit" },
  water: { ch: "~", cls: "t-water" },
  sea: { ch: "≈", cls: "t-sea" },
  rubble: { ch: "%", cls: "t-rubble" },
  grass: { ch: '"', cls: "t-grass" },
  sand: { ch: ":", cls: "t-sand" },
};

export function CaveScene(props: { run: RunState; node: MapNode; onLegDone: () => void }) {
  const run = props.run;
  const map = makeLocalMap(run.runName, props.node);
  // Drop encounter spawn determinism (operator decision): mix fresh entropy
  // into the grass rng so re-entering the same leg produces different
  // encounters each visit.
  const grassRng = new Rng(seedFrom("grass:" + run.runName + ":" + props.node.id + ":" + Date.now()));
  // Drop battle determinism (operator decision): the nonce starts at a fresh
  // value so the same battle scenario produces different outcomes each
  // attempt. Each requestEncounter still increments to keep nonces unique.
  let battleNonce = Date.now() & 0x7fffffff;
  const explored = new Set<number>();

  const [beat, bump] = createSignal(0, { equals: false }); // re-render on move
  const [flick, setFlick] = createSignal(0); // follower flicker
  const biomePhrase = BIOME_PHRASE[biomeOf(props.node.rank)] ?? "the wilds";
  const stageIntro = stageFlavor(run);
  // The stage flavor (DESIGN.md §5) carries the long walk's character; when
  // empty (stages 0/1/2 — the tutorial latitudes) we fall back to the
  // generic explore prompt.
  const [msg, setMsg] = createSignal(
    stageIntro.length > 0
      ? `A leg south — ${biomePhrase}. ${stageIntro}`
      : `A leg south — ${biomePhrase}. Explore; engage what you dare.`,
  );
  const [inventoryOpen, setInventoryOpen] = createSignal(false);
  // The Cinder trails the cell you just left.
  let fx = map.px;
  let fy = map.py;
  // A pending encounter we raised; resolved when the bus clears.
  let pending: { site: EncounterSite | null; back: string } | null = null;
  // Duel `D`s that have spotted you — once awake they hunt until the duel.
  const awoke = new Set<EncounterSite>();

  // Light reach from the bonded fire (bible §8 — the Cinder is the lantern).
  const lightRadius = () => {
    const fire = run.circle[0];
    if (fire === undefined || !isAlive(fire)) return 3;
    return Math.max(3, Math.min(12, 3 + Math.round(fire.vitality * 6) + (isBurnBright(fire) ? 2 : 0)));
  };

  function resolvePending() {
    if (pending === null) return;
    if (pending.site !== null) pending.site.resolved = true;
    setMsg(pending.back);
    pending = null;
    bump(0);
  }

  // Operator cap: only ONE duelist hunts at a time. Pre-placed `D`s wait
  // until the current pursuer is settled before any of them wakes.
  const hasActivePursuer = (): boolean => {
    for (const s of awoke) if (!s.resolved) return true;
    return false;
  };

  // A duel `D` sleeps until it sees you with YOUR exact area of vision; then
  // it hunts — one step per your step — and springs the duel when it catches
  // up (reaches you or stands adjacent). Returns true if it raised the duel.
  // At most one duelist is ever in the awake set; others stay dormant.
  function advancePursuers(): boolean {
    const R = lightRadius();
    // Find the current active pursuer (at most one).
    let active: EncounterSite | null = null;
    for (const s of awoke) {
      if (!s.resolved && s.kind === "duel") { active = s; break; }
    }
    // If no one is hunting, wake at most one fresh duelist whose FOV reaches us.
    if (active === null) {
      for (const s of map.sites) {
        if (s.kind !== "duel" || s.resolved || awoke.has(s)) continue;
        if (canSeeFrom(map, s.x, s.y, map.px, map.py, R)) {
          awoke.add(s);
          setMsg("A duelist spots you across the dark — and starts toward you.");
          active = s;
          break;
        }
      }
    }
    if (active === null) return false;
    const next = stepToward(map, active.x, active.y, map.px, map.py);
    active.x = next[0];
    active.y = next[1];
    bump(0);
    if (Math.max(Math.abs(active.x - map.px), Math.abs(active.y - map.py)) <= 1) {
      triggerSite(active); // it catches you — the duel
      return true;
    }
    return false;
  }

  function triggerSite(site: EncounterSite): void {
    switch (site.kind) {
      case "duel":
        // A marked site: another person + their Cinder. Never catchable.
        run.phase = "encounter";
        pending = { site, back: "The duel is settled." };
        requestEncounter("battle", run, props.node, battleNonce++, "duel");
        return;
      case "camp":
        // B2.2: H point consumes a cache to restore coherence to full for
        // all fires. If no cache, the H lies cold — nothing happens.
        if (useCache(run.inventory)) {
          tendFires(run);
          for (const fire of run.circle) {
            if (isAlive(fire)) fire.coherenceFrac = 1;
          }
          setMsg("You make camp here. The cache is spent; the fires are restored.");
          site.resolved = true;
        } else {
          setMsg("The H lies cold — you have no supplies to make camp here.");
          // Not marked resolved — the player can return if they find a cache.
        }
        return;
      case "forage":
        // B2.2: foraging finds a cache directly.
        addCache(run.inventory, 1);
        setMsg("A good patch — a cache of supplies.");
        site.resolved = true;
        return;
      case "ruin": {
        // Seeded mixed table — deterministic per this ruin (run/leg/x/y).
        const left = unrecoveredFlashbacks(run.meta.memories);
        const lat = Math.max(0, props.node.rank) / 7;
        const roll = rollRuin(
          "ruin:" + run.runName + ":" + props.node.id + ":" + site.x + ":" + site.y,
          left.length,
          lat,
        );
        // Ruin XP grant: memory/relic/cache pay XP to the bonded fire as
        // a felt reward — the Cinder learned something from walking here.
        // Wild bands grant nothing (the battle pays).
        if (roll.xp > 0) gainXp(run.circle[0], roll.xp);
        if (roll.kind === "wild") {
          // Something was nesting here — a rubble-pool wild springs.
          run.phase = "encounter";
          pending = { site, back: "The ruins go quiet again." };
          requestEncounter("battle", run, props.node, battleNonce++, "rubble");
          return;
        }
        if (roll.kind === "memory") {
          recoverMemoryInRun(run, left[0].id); // left.length>0 guaranteed here
        } else if (roll.kind === "relic") {
          // B2.2: relic surfaces as a named item, persistent in meta.relics.
          if (roll.relicName && !run.meta.relics.includes(roll.relicName)) {
            run.meta.relics.push(roll.relicName);
          }
          // Keep the dex grant for backward compat (existing players see
          // the relic in the species dex too).
          applySpoils(run, {
            dex: [{ species: roll.relicSpecies, trueClass: "inert", firstSeenStage: currentStage(run) }],
          });
        }
        // B2.2 cache + restorative grants. Applied directly to inventory,
        // not via applySpoils.provisions (which goes through the bridge).
        if (roll.caches > 0) addCache(run.inventory, roll.caches);
        if (roll.restoratives > 0) addRestorative(run.inventory, roll.restoratives);
        setMsg(roll.message);
        site.resolved = true;
        return;
      }
    }
  }

  function move(dx: number, dy: number) {
    if (encounterRequest() !== null) return; // paused under an encounter
    if (run.outcome !== "running") return props.onLegDone();
    const ox = map.px;
    const oy = map.py;
    const res = tryMove(map, dx, dy);
    if (res === "blocked") return;
    if (res === "exit") return props.onLegDone();
    // moved
    fx = ox;
    fy = oy;
    bump(0);
    const site = siteAt(map, map.px, map.py);
    if (site !== undefined && !site.resolved) {
      triggerSite(site);
      return;
    }
    if (advancePursuers()) return; // a hunting duelist caught you first
    const t = map.tiles[map.py * map.w + map.px];
    // Stage modifiers (DESIGN.md §5) tune encounter density — Sonoran/Sierra
    // Madre dampen it, Yucatan/Isthmus amplify it, Andes pulls back so each
    // fight is alpha-tier.
    const p = (0.07 + 0.16 * (props.node.danger ?? 0)) * stageEncounterMul(run);
    if (t === "water" && grassRng.chance(p)) {
      run.phase = "encounter";
      pending = { site: null, back: "The tide recedes." };
      requestEncounter("tide", run);
    } else if (t === "grass" && grassRng.chance(p)) {
      run.phase = "encounter";
      pending = { site: null, back: "The wild fire is dealt with." };
      requestEncounter("battle", run, props.node, battleNonce++, "grass");
    } else if (t === "rubble" && grassRng.chance(p)) {
      run.phase = "encounter";
      pending = { site: null, back: "The thing in the rubble is dealt with." };
      requestEncounter("battle", run, props.node, battleNonce++, "rubble");
    }
    // Random chance a duelist steps onto the road from elsewhere. Off-screen
    // spawn; the existing pursuit machinery (canSeeFrom + stepToward) picks
    // them up once their FOV reaches the player — they don't ambush, they
    // hunt. Skip if a tile encounter just fired (the move beat is spent), or
    // if a duelist is already hunting (operator cap: one at a time).
    if (encounterRequest() === null && !hasActivePursuer()) {
      const spawnP = 0.02 + 0.04 * (props.node.danger ?? 0);
      if (grassRng.chance(spawnP)) {
        const spawned = spawnDuelSite(map, grassRng, map.px, map.py);
        if (spawned !== null) {
          setMsg("Someone has stepped onto the road from elsewhere.");
        }
      }
    }
  }

  onMount(() => {
    const fl = window.setInterval(() => setFlick((v) => v + 1), 150);
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (inventoryOpen()) {
        if (e.key === "Escape" || e.key === "Enter" || e.key === "i" || e.key === "I") {
          e.preventDefault();
          setInventoryOpen(false);
        }
        return;
      }
      // While an encounter is up, it owns input.
      if (encounterRequest() !== null) return;
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setInventoryOpen(true);
        return;
      }
      // Returned from an encounter we raised → resolve it.
      if (pending !== null) resolvePending();
      if (e.key === "Escape") { e.preventDefault(); return props.onLegDone(); }
      if (e.key === "ArrowUp") { e.preventDefault(); move(0, -1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); move(0, 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); move(1, 0); }
    }
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      clearInterval(fl);
      window.removeEventListener("keydown", onKey);
    });
  });

  // When an encounter App raised over us clears, resolve what it was for
  // (mark the site done, update the message) — no keypress needed.
  createEffect(() => {
    if (encounterRequest() === null && pending !== null) resolvePending();
  });

  // The lit grid, recomputed on move (beat) and follower tick (flick).
  const grid = createMemo(() => {
    beat();
    flick();
    const R = lightRadius();
    const vis = computeVisible(map, map.px, map.py, R);
    for (const i of vis) explored.add(i);
    const fch = CINDER_FOLLOW[flick() % CINDER_FOLLOW.length];
    const rows: Array<Array<{ ch: string; cls: string }>> = [];
    for (let y = 0; y < map.h; y++) {
      const row: Array<{ ch: string; cls: string }> = [];
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        const lit = vis.has(i);
        if (!lit && !explored.has(i)) { row.push({ ch: " ", cls: "c-void" }); continue; }
        const t = map.tiles[i];
        const base = TILE[t];
        if (base === null) { row.push({ ch: " ", cls: "c-void" }); continue; }
        // Tier by distance from the Cinder's light → a soft torch falloff.
        let tier = "c-mem";
        if (lit) {
          const d = Math.max(Math.abs(x - map.px), Math.abs(y - map.py));
          tier = d <= R * 0.45 ? "c-bright" : d <= R * 0.8 ? "c-mid" : "c-far";
        }
        let cell = { ch: base.ch, cls: `${base.cls} ${tier}` };
        const s = siteAt(map, x, y);
        if (s !== undefined && (lit || explored.has(i))) {
          const sg = SITE[s.kind];
          cell = s.resolved
            ? { ch: ".", cls: `c-mem` }
            : { ch: sg.ch, cls: `${sg.cls} ${lit ? "c-bright" : "c-mem"}` };
        }
        if (x === fx && y === fy) cell = { ch: fch, cls: "cave-cinder c-bright" };
        if (x === map.px && y === map.py) {
          cell = { ch: (map.px + map.py) & 1 ? "Ô" : "ô", cls: "cave-you c-bright" };
        }
        row.push(cell);
      }
      rows.push(row);
    }
    return rows;
  });

  return (
    <div class="cave-root">
      <p class="cave-title">
        {currentStage(run)} — {BIOME_PHRASE[biomeOf(props.node.rank)] ?? "the wilds"}
      </p>
      <div class="cave-stage" style={{ "--cols": map.w, "--rows": map.h }}>
        <For each={grid()}>
          {(row) => (
            <div class="cave-row">
              <For each={row}>{(c) => <span class={c.cls}>{c.ch}</span>}</For>
            </div>
          )}
        </For>
      </div>
      <p class="cave-msg">{msg()}</p>
      <p class="cave-hint">
        arrows: walk · [I] inventory · the Cinder lights the way & trails you · v: leave south · [Esc] abandon the leg
      </p>
      <Show when={inventoryOpen()}>
        <InventoryDialog run={run} onClose={() => setInventoryOpen(false)} />
      </Show>
    </div>
  );
}
