// localStorage persistence for cross-run meta-state (DESIGN.md §9): the species
// dex/almanac and the memorial of dead bonded Cinders. Run-scoped state is NOT
// stored here. Keys are namespaced to this game (no collision with the old
// /workspace/ludus-ignis tutor saves).

const PREFIX = "ludus-ignis-game.";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: meta-progression is best-effort, never fatal.
  }
}

export function clearAll(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith(PREFIX)) doomed.push(k);
    }
    for (let i = 0; i < doomed.length; i++) localStorage.removeItem(doomed[i]);
  } catch {
    // ignore
  }
}
