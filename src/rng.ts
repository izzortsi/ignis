// Deterministic RNG for seeded, shareable roguelite runs (DESIGN.md §11).
//
// splitmix64 over BigInt masked to 64 bits. Same seed -> same run, byte-stable
// across machines. chance() uses Math.fround so a probability gate is decided in
// f32, keeping parity with a Rust f32 < f32 comparison (the prior /workspace/ignis
// line was verified bit-identical this way).

const MASK64 = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;
const MIX_A = 0xbf58476d1ce4e5b9n;
const MIX_B = 0x94d049bb133111ebn;

export class Rng {
  // Convention-private: state is internal; do not read/write directly.
  _state: bigint;

  constructor(seed: bigint) {
    this._state = seed & MASK64;
  }

  // Next raw 64-bit value.
  nextU64(): bigint {
    this._state = (this._state + GOLDEN) & MASK64;
    let z = this._state;
    z = ((z ^ (z >> 30n)) * MIX_A) & MASK64;
    z = ((z ^ (z >> 27n)) * MIX_B) & MASK64;
    z = z ^ (z >> 31n);
    return z & MASK64;
  }

  // Uniform f64 in [0, 1) from the top 53 bits.
  nextFloat(): number {
    const bits = this.nextU64() >> 11n;
    return Number(bits) / 9007199254740992; // 2^53
  }

  // Uniform integer in [0, bound). bound must be > 0.
  nextInt(bound: number): number {
    if (bound <= 0) return 0;
    return Math.floor(this.nextFloat() * bound);
  }

  // Probability gate decided in f32 (parity with Rust f32 < f32).
  chance(p: number): boolean {
    const bits = this.nextU64() >> 40n;
    const r = Math.fround(Number(bits) / 16777216); // 2^24
    return r < Math.fround(p);
  }

  // Pick an element uniformly. Returns undefined for an empty array.
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.nextInt(items.length)];
  }
}

// FNV-1a 32-bit over the UTF-8 bytes of `text`, widened to a 64-bit seed.
// Lets a human-typed Cinder name or run name seed a whole run.
export function seedFrom(text: string): bigint {
  const bytes = new TextEncoder().encode(text);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Widen the 32-bit hash through one splitmix step so short names spread well.
  const widened = (BigInt(hash) * GOLDEN) & MASK64;
  return widened === 0n ? GOLDEN : widened;
}
