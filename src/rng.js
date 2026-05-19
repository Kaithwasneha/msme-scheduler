'use strict';

// Mulberry32 — fast seeded PRNG, no external dependencies
function createRNG(seed) {
  let s = (seed ^ 0xDEADBEEF) >>> 0;

  function next() {
    s += 0x6D2B79F5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  return {
    random: next,
    randint(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    uniform(lo, hi) { return lo + next() * (hi - lo); }
  };
}

module.exports = { createRNG };
