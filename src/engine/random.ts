// Seeded randomness (SPEC §6.2, §8): the same seed gives the same numbers in the app and the Worker.

export interface Rng {
  /** A whole number from min to max, both included. */
  int(min: number, max: number): number
}

/** mulberry32: a small, fast 32-bit generator. Only determinism matters here, not crypto strength. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  }
}
