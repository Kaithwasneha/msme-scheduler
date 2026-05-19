'use strict';
const { computePenalty } = require('./penalty');

/**
 * Backtracking optimal solver with F1/F2/F3 pruning.
 * Safe for n ≤ 12; exponential worst-case without pruning.
 * Returns the same output shape as scheduler.js.
 */
function bruteForce(instance) {
  const startTime = Date.now();
  const { tasks, conflicts, resources, capacities, windows, weights, K } = instance;
  const n = tasks.length;
  const D = capacities[0].length;

  // Build adjacency set for fast F1 pruning
  const adj = Array.from({ length: n }, () => new Set());
  for (const [i, j] of conflicts) { adj[i].add(j); adj[j].add(i); }

  const assignment = new Array(n).fill(-1);
  const slotUsage = Array.from({ length: K }, () => new Float64Array(D));
  let bestPenalty = Infinity;
  let bestAssignment = null;

  function bt(idx) {
    if (idx === n) {
      const p = computePenalty(assignment, weights, windows, resources, capacities, K);
      if (p < bestPenalty) { bestPenalty = p; bestAssignment = [...assignment]; }
      return;
    }
    const [lo, hi] = windows[idx];
    for (let s = lo; s <= hi; s++) {
      // F1 prune: skip if any assigned neighbour is already in slot s
      let blocked = false;
      for (const j of adj[idx]) { if (assignment[j] === s) { blocked = true; break; } }
      if (blocked) continue;

      // F2 prune: skip if slot s would exceed capacity in any dimension
      let fits = true;
      for (let d = 0; d < D; d++) {
        if (slotUsage[s][d] + resources[idx][d] > capacities[s][d] + 1e-9) { fits = false; break; }
      }
      if (!fits) continue;

      assignment[idx] = s;
      for (let d = 0; d < D; d++) slotUsage[s][d] += resources[idx][d];
      bt(idx + 1);
      assignment[idx] = -1;
      for (let d = 0; d < D; d++) slotUsage[s][d] -= resources[idx][d];
    }
  }

  bt(0);

  const runtime_ms = Date.now() - startTime;
  if (!bestAssignment) {
    return { assignment: null, penalty: null, feasible: false, violation_reason: 'No valid assignment exists', runtime_ms };
  }
  const assignMap = {};
  for (let i = 0; i < n; i++) assignMap[tasks[i]] = bestAssignment[i];
  return { assignment: assignMap, penalty: bestPenalty, feasible: true, violation_reason: null, runtime_ms };
}

module.exports = { bruteForce };
