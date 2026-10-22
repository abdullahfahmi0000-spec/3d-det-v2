/**
 * Small deterministic generator in [0, 1), so procedural props look the same on every load.
 */
export function seededRandom(seed: number): () => number {
  let state = Math.abs(Math.floor(seed)) % 233280;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}
