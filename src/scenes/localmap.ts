// The walkable local map scene. A leg's cave holds several optional, mixed
// encounters scattered through it (a rival fire and a stores cache can sit in
// the same cave). The player explores by Cinder-light and chooses what to
// engage; the south exit (v) is always open — leave whenever.

import type { Input, Scene, SceneCmd } from "../scene";
import { Cmd } from "../scene";
import { Screen, Palette, PLAYER, PLAYER_SPRITE, type Color } from "../screen";
import { tendFires, applySpoils, currentStage, type RunState } from "../core/run";
import type { MapNode } from "../core/routemap";
import {
  makeLocalMap,
  tryMove,
  siteAt,
  computeVisible,
  biomeOf,
  type LocalMap,
  type Tile,
  type Biome,
  type EncounterKind,
  type EncounterSite,
} from "../core/localmap";
import { isAlive, isBurnBright } from "../core/cinder";
import { Rng, seedFrom } from "../rng";
import { requestEncounter } from "../core/encounter-bus";

const BIOME_PHRASE: Record<Biome, string> = {
  forest: "wooded foothills",
  coast: "the coast",
  ruins: "glassed ruins",
  desert: "open sand",
  mountain: "a mountain ledge",
  jungle: "deep green",
  isthmus: "a narrow neck of land",
  alpine: "thin air, high peaks",
};

const SITE_GLYPH: Record<EncounterKind, { ch: string; col: Color }> = {
  duel: { ch: "D", col: Palette.danger },
  forage: { ch: "&", col: Palette.warn },
  ruin: { ch: "?", col: Palette.native },
  camp: { ch: "H", col: Palette.ember },
};

function dangerWord(d: number): string {
  return d < 0.33 ? "low" : d < 0.6 ? "uneasy" : d < 0.82 ? "hard" : "grim";
}

export class LocalMapScene implements Scene {
  run: RunState;
  node: MapNode;
  map: LocalMap;
  message: string;
  pendingSub = false; // a sub-scene (tide/duel) was pushed; resolve its site on return
  pendingSite: EncounterSite | null = null;
  subReturnMsg = "";
  explored = new Set<number>(); // remembered tiles, shown dim outside the light
  grassRng: Rng; // deterministic per visit: same path -> same grass encounters
  battleNonce = 0; // bumps per battle so each encounter in a leg is a fresh foe

  constructor(run: RunState, node: MapNode) {
    this.run = run;
    this.node = node;
    this.map = makeLocalMap(run.runName, node);
    this.grassRng = new Rng(seedFrom("grass:" + run.runName + ":" + node.id));
    this.message = `A leg south — danger ${dangerWord(node.danger)}. Explore; engage what you dare.`;
  }

  private triggerSite(site: EncounterSite): SceneCmd {
    const run = this.run;
    switch (site.kind) {
      case "duel":
        run.phase = "encounter";
        this.pendingSub = true;
        this.pendingSite = site;
        this.subReturnMsg = "The duel is settled.";
        requestEncounter("battle", run, this.node, this.battleNonce++);
        return Cmd.none;
      case "camp":
        tendFires(run);
        applySpoils(run, { provisions: -0.05 });
        this.message = "You make camp here; the fires are tended.";
        site.resolved = true;
        break;
      case "forage":
        applySpoils(run, { provisions: 0.2 });
        this.message = "A good patch — stores replenished.";
        site.resolved = true;
        break;
      case "ruin":
        applySpoils(run, {
          provisions: 0.05,
          dex: [{ species: "pre-collapse relic", trueClass: "inert", firstSeenStage: currentStage(run) }],
        });
        this.message = "Glassed ruins. You read a relic — handless, but it tells a story.";
        site.resolved = true;
        break;
    }
    return Cmd.none;
  }

  update(_dt: number, input: Input): SceneCmd {
    const run = this.run;
    if (run.outcome !== "running") return Cmd.pop; // wiped inside an encounter

    if (this.pendingSub) {
      this.pendingSub = false;
      if (this.pendingSite !== null) this.pendingSite.resolved = true;
      this.pendingSite = null;
      this.message = this.subReturnMsg;
      return Cmd.none;
    }

    if (input.pressed.has("Escape")) return Cmd.pop;

    let dx = 0;
    let dy = 0;
    if (input.pressed.has("ArrowUp")) dy = -1;
    else if (input.pressed.has("ArrowDown")) dy = 1;
    else if (input.pressed.has("ArrowLeft")) dx = -1;
    else if (input.pressed.has("ArrowRight")) dx = 1;
    if (dx === 0 && dy === 0) return Cmd.none;

    const res = tryMove(this.map, dx, dy);
    if (res === "exit") return Cmd.pop; // leg done; back to the route map
    if (res === "moved") {
      const site = siteAt(this.map, this.map.px, this.map.py);
      if (site !== undefined && !site.resolved) return this.triggerSite(site);
      const tile = this.map.tiles[this.map.py * this.map.w + this.map.px];
      const p = 0.07 + 0.16 * (this.node.danger ?? 0);
      // Water: a mirror-tide ingresses. (Solid encounter via the bus.)
      if (tile === "water" && this.grassRng.chance(p)) {
        this.run.phase = "encounter";
        this.pendingSub = true;
        this.pendingSite = null;
        this.subReturnMsg = "The tide recedes.";
        requestEncounter("tide", this.run);
        return Cmd.none;
      }
      // Tall grass: a wild fire flares out — a battle / a chance to kindle it.
      if (tile === "grass" && this.grassRng.chance(p)) {
        this.run.phase = "encounter";
        this.pendingSub = true;
        this.pendingSite = null;
        this.subReturnMsg = "The wild fire is dealt with.";
        requestEncounter("battle", this.run, this.node, this.battleNonce++);
        return Cmd.none;
      }
    }
    return Cmd.none;
  }

  // Light radius from the bonded fire: bright sees far, a dying fire is nearly
  // blind (bible §8 — the Cinder is the only lantern).
  private lightRadius(): number {
    const fire = this.run.circle[0];
    if (fire === undefined || !isAlive(fire)) return 3;
    const r = 3 + Math.round(fire.vitality * 5) + (isBurnBright(fire) ? 2 : 0);
    return Math.max(3, Math.min(11, r));
  }

  private glyph(t: Tile): { ch: string; col: Color } {
    switch (t) {
      case "floor": return { ch: "·", col: Palette.dim };
      case "water": return { ch: "~", col: Palette.native };
      case "rubble": return { ch: "%", col: Palette.warn };
      case "grass": return { ch: '"', col: Palette.mirror };
      case "sand": return { ch: ":", col: Palette.emberDim };
      case "sea": return { ch: "≈", col: Palette.native };
      case "wall": return { ch: "#", col: Palette.text };
      case "exit": return { ch: "v", col: Palette.native };
      case "cliff": return { ch: " ", col: Palette.bg };
    }
  }

  render(screen: Screen): void {
    const m = this.map;
    const radius = this.lightRadius();
    const vis = computeVisible(m, m.px, m.py, radius);
    for (const i of vis) this.explored.add(i);

    screen.textCentered(0, `${currentStage(this.run)} — ${BIOME_PHRASE[biomeOf(this.node.rank)]}`, Palette.ember);

    const ox = Math.floor((screen.cols - m.w) / 2);
    const oy = 2;
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x;
        const lit = vis.has(i);
        if (!lit && !this.explored.has(i)) continue; // unseen: darkness
        const t: Tile = m.tiles[i];
        if (t === "cliff") continue; // the drop is void either way
        const g = this.glyph(t);
        screen.put(ox + x, oy + y, g.ch, lit ? g.col : Palette.dim);
      }
    }

    // Encounter sites on top of terrain (only where seen).
    for (const s of m.sites) {
      const i = s.y * m.w + s.x;
      if (!vis.has(i) && !this.explored.has(i)) continue;
      const lit = vis.has(i);
      const g = SITE_GLYPH[s.kind];
      screen.put(ox + s.x, oy + s.y, s.resolved ? "." : g.ch, s.resolved ? Palette.dim : lit ? g.col : Palette.dim);
    }

    screen.put(ox + m.px, oy + m.py, PLAYER_SPRITE[(m.px + m.py) & 1], PLAYER.col);

    screen.textCentered(oy + m.h + 1, this.message, Palette.text);
    screen.textCentered(
      screen.rows - 2,
'arrows move · Cinder-light · "grass = wild encounters · &forage Hcamp ?ruin Dduel · v=south · [Esc] leave',
      Palette.dim,
    );
  }
}
