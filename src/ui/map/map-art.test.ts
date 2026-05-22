import { describe, it, expect } from "vitest";
import {
  buildCampArt,
  buildPaths,
  MAP_DIMS,
  HEARTH_BOX,
  CINDER_BOX,
  APPRENTICE_SPAWN,
  isWalkable,
  interactableAt,
  AURORA_FRAMES,
  AURORA_FRAMES_COUNT,
  HEARTH_FIRE_FRAMES,
  CINDER_FIRE_FRAMES,
  FRAMES,
  type PathGate,
} from "./map-art";
import type { Biome } from "../../core/localmap";

const ALL_BIOMES: Biome[] = [
  "forest", "coast", "ruins", "desert", "mountain", "jungle", "isthmus", "alpine",
];

describe("buildCampArt (DESIGN.md §5 — camp reflects stage)", () => {
  it("returns three layers of the correct dimensions for every biome", () => {
    for (const b of ALL_BIOMES) {
      const art = buildCampArt(b);
      expect(art.biome).toBe(b);
      expect(art.terrain.length).toBe(MAP_DIMS.rows);
      for (const row of art.terrain) expect(row.length).toBe(MAP_DIMS.cols);
      const screeRows = art.scree.split("\n");
      expect(screeRows.length).toBe(MAP_DIMS.rows);
      for (const row of screeRows) expect(row.length).toBe(MAP_DIMS.cols);
      const starRows = art.stars.split("\n");
      expect(starRows.length).toBe(MAP_DIMS.rows);
      for (const row of starRows) expect(row.length).toBe(MAP_DIMS.cols);
    }
  });

  it("is deterministic per biome — same biome, same output", () => {
    for (const b of ALL_BIOMES) {
      const a = buildCampArt(b);
      const c = buildCampArt(b);
      expect(a.terrain).toEqual(c.terrain);
      expect(a.scree).toBe(c.scree);
      expect(a.stars).toBe(c.stars);
    }
  });

  it("different biomes produce different terrain", () => {
    const seen = new Set<string>();
    for (const b of ALL_BIOMES) {
      seen.add(buildCampArt(b).terrain.join("\n"));
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it("Hearth pit and Cinder vessel are present in every biome", () => {
    for (const b of ALL_BIOMES) {
      const terrain = buildCampArt(b).terrain.join("\n");
      expect(terrain).toContain("oOoOoOo");
      expect(terrain).toContain("[___]");
    }
  });

  it("walkability and interactables stay biome-independent", () => {
    expect(isWalkable(APPRENTICE_SPAWN.row, APPRENTICE_SPAWN.col)).toBe(true);
    expect(interactableAt(HEARTH_BOX.rowMin + 1, HEARTH_BOX.colMin + 2)).toBe("hearth");
    expect(interactableAt(CINDER_BOX.rowMin + 1, CINDER_BOX.colMin + 2)).toBe("cinder");
  });

  it("aurora and fire frame counts are unchanged", () => {
    expect(AURORA_FRAMES.length).toBe(AURORA_FRAMES_COUNT);
    expect(HEARTH_FIRE_FRAMES.length).toBe(FRAMES);
    expect(CINDER_FIRE_FRAMES.length).toBe(FRAMES);
  });
});

describe("buildPaths (DESIGN.md §5 — visual paths extending south from gates)", () => {
  it("returns canvas-shaped output for empty gates", () => {
    const s = buildPaths([]);
    const rows = s.split("\n");
    expect(rows.length).toBe(MAP_DIMS.rows);
    for (const row of rows) expect(row.length).toBe(MAP_DIMS.cols);
  });

  it("returns canvas-shaped output with gates", () => {
    const s = buildPaths([
      { biome: "desert", gateRow: 45, gateCol: 15 },
      { biome: "jungle", gateRow: 45, gateCol: 30 },
      { biome: "alpine", gateRow: 45, gateCol: 50 },
    ]);
    const rows = s.split("\n");
    expect(rows.length).toBe(MAP_DIMS.rows);
    for (const row of rows) expect(row.length).toBe(MAP_DIMS.cols);
  });

  it("paints something south of a gate placed at the plateau interior", () => {
    const s = buildPaths([
      { biome: "desert", gateRow: 45, gateCol: 30 },
    ]);
    expect(s.replace(/[ \n]/g, "").length).toBeGreaterThan(0);
  });

  it("never paints north of the gate row (paths extend south only)", () => {
    const s = buildPaths([{ biome: "ruins", gateRow: 40, gateCol: 30 }]);
    const rows = s.split("\n");
    for (let r = 0; r < 40; r++) {
      expect(rows[r].trim()).toBe("");
    }
  });

  it("handles all 8 biomes without crashing", () => {
    const gates: PathGate[] = ALL_BIOMES.map((b, i) => ({
      biome: b,
      gateRow: 45,
      gateCol: 5 + i * 7,
    }));
    const s = buildPaths(gates);
    const rows = s.split("\n");
    expect(rows.length).toBe(MAP_DIMS.rows);
  });
});



