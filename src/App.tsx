// App shell + flow. Title → Initiation (names the Cinder) → the CAMP is the
// hub AND the route map: from camp you walk to a south gate (= a reachable
// leg) to enter that dungeon, then return to camp; repeat until the equator
// (or the tribe is lost). Achievements (dex/caught/memorial) are read from a
// camp interactable. run + route live HERE and persist by reference across
// legs (the cave mutates the same RunState).

import { createSignal, Switch, Match, Show } from "solid-js";
import { TitleMenu } from "./ui/menu/TitleMenu";
import { IntroScene } from "./ui/intro/IntroScene";
import { CampScene } from "./ui/map/CampScene";
import { CaveScene } from "./ui/map/CaveScene";
import { encounterRequest } from "./core/encounter-bus";
import { TideEncounter } from "./ui/encounter/TideEncounter";
import { BattleEncounter } from "./ui/encounter/BattleEncounter";
import { startRun, setStage, arriveAtEquator, tendFires, type RunState } from "./core/run";
import { makeRoute, moveTo, stageOf, type RouteMap, type MapNode } from "./core/routemap";

type Phase = "title" | "intro" | "camp" | "leg" | "ended";

export function App() {
  const [phase, setPhase] = createSignal<Phase>("title");
  const [name, setName] = createSignal("");
  // run + route are created once per run, owned here, shared by reference.
  const [run, setRun] = createSignal<RunState | null>(null);
  const [route, setRoute] = createSignal<RouteMap | null>(null);
  const [leg, setLeg] = createSignal<MapNode | null>(null);
  let seq = 0;

  function beginRun(cinderName: string) {
    seq += 1;
    const runName = `${cinderName}#${seq}`;
    setName(cinderName);
    setRun(startRun(runName));
    setRoute(makeRoute(runName));
    setPhase("camp");
  }

  // Walked into a south gate at camp = take that leg.
  function enterLeg(node: MapNode) {
    const r = run()!;
    const rt = route()!;
    if (node.kind === "end") {
      arriveAtEquator(r); // reached the equator — the run ends, won
      setPhase("ended");
      return;
    }
    moveTo(rt, node.id);
    setStage(r, stageOf(node));
    setLeg(node);
    setPhase("leg");
  }

  // Back from a leg's cave: the run may have ended (tribe-wiped) inside it.
  // Returning to the camp hub IS the recovery beat (DESIGN.md §8 / the
  // camp→gate→cave→camp loop): rest the Circle here — restPeriod restores
  // vitality (partial) and coherence (full), memorialises/re-embers the
  // fallen. (tendFires, not tendCamp: App owns stage advance via setStage.)
  function legDone() {
    const r = run()!;
    if (r.outcome === "running") {
      tendFires(r);
      setPhase("camp");
    } else {
      setPhase("ended");
    }
  }

  return (
    <>
    <Switch>
      <Match when={phase() === "title"}>
        <TitleMenu onBegin={() => setPhase("intro")} />
      </Match>
      <Match when={phase() === "intro"}>
        <IntroScene onComplete={(n) => beginRun(n)} />
      </Match>
      <Match when={phase() === "camp"}>
        <CampScene cinderName={name()} run={run()!} route={route()!} onEnterLeg={enterLeg} />
      </Match>
      <Match when={phase() === "leg"}>
        <CaveScene run={run()!} node={leg()!} onLegDone={legDone} />
      </Match>
      <Match when={phase() === "ended"}>
        <div class="title-root">
          <div class="title-card">
            <h1
              class="title-heading"
              style={{ color: run()!.outcome === "arrived" ? "var(--safe-strong)" : "var(--danger-strong)" }}
            >
              {run()!.outcome === "arrived" ? "THE EQUATOR" : "THE TRIBE IS LOST"}
            </h1>
            <p class="title-tagline">
              {run()!.outcome === "arrived"
                ? "you carried the fire to the middle of the world."
                : "the long walk south ends here."}
            </p>
            <p class="title-hint">
              dex {run()!.meta.dex.length} · caught {run()!.meta.caught.length} · memorial{" "}
              {run()!.meta.memorial.length} — all of it outlasts this run
            </p>
            <div class="title-menu">
              <button class="title-item is-sel" onClick={() => setPhase("title")}>
                » to the fire
              </button>
            </div>
          </div>
        </div>
      </Match>
    </Switch>
    {/* Encounters overlay the cave (the bus is raised from CaveScene). */}
    <Show when={encounterRequest()}>
      {(r) =>
        r().kind === "tide" ? (
          <TideEncounter run={r().run} />
        ) : r().kind === "battle" ? (
          <BattleEncounter run={r().run} node={r().node!} nonce={r().nonce ?? 0} source={r().source ?? "grass"} />
        ) : null
      }
    </Show>
    </>
  );
}
