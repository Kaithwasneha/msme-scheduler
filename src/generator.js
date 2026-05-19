'use strict';
const { createRNG } = require('./rng');

/**
 * Port of the Python instance generator from the assignment spec.
 * Uses Mulberry32 instead of Python's Mersenne Twister — values differ
 * but statistical properties are equivalent. Accepts JSON input produced
 * by the Python generator when passed via --input flag.
 */
function generateInstance(n, K, d = 4, conflictDensity = 0.3, seed = 42) {
  const rng = createRNG(seed);

  const tasks = Array.from({ length: n }, (_, i) => `T${i}`);

  const conflicts = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rng.random() < conflictDensity) conflicts.push([i, j]);
    }
  }

  const cap = [32, 128, 8, 6.0];
  const resources = Array.from({ length: n }, () =>
    Array.from({ length: 4 }, (_, dim) =>
      rng.uniform(1, Math.floor(cap[dim] / (Math.floor(n / K) + 1)))
    )
  );

  const capacities = Array.from({ length: K }, () => [...cap]);

  const windows = Array.from({ length: n }, () => {
    const lo = rng.randint(0, K - 2);
    const hi = rng.randint(lo + 1, K - 1);
    return [lo, hi];
  });

  const weights = Array.from({ length: n }, () => rng.uniform(1, 10));

  return { tasks, conflicts, resources, capacities, windows, weights, K };
}

module.exports = { generateInstance };
