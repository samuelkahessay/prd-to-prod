export function createSeededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
