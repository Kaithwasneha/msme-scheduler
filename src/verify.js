'use strict';

/**
 * Checks all three feasibility constraints:
 *   F1 — no conflicting tasks share a slot
 *   F2 — no slot exceeds resource capacity in any dimension
 *   F3 — every task is assigned within its SLA window
 *
 * @param {number[]} assignment  - assignment[i] = slot index for task i
 * @param {Array}    conflicts   - [[i,j], ...] pairs of conflicting task indices
 * @param {Array}    resources   - resources[i][d]
 * @param {Array}    capacities  - capacities[s][d]
 * @param {Array}    windows     - windows[i] = [lo, hi]
 * @param {number}   K
 * @returns {{ valid: boolean, reason: string|null }}
 */
function verify(assignment, conflicts, resources, capacities, windows, K) {
  const n = assignment.length;
  const D = capacities[0].length;

  // F1: conflict check
  for (const [i, j] of conflicts) {
    if (assignment[i] === assignment[j]) {
      return { valid: false, reason: `F1: tasks ${i} and ${j} both in slot ${assignment[i]}` };
    }
  }

  // F2: resource capacity check (accumulate per slot)
  const usage = Array.from({ length: K }, () => new Array(D).fill(0));
  for (let i = 0; i < n; i++) {
    const s = assignment[i];
    for (let d = 0; d < D; d++) {
      usage[s][d] += resources[i][d];
      if (usage[s][d] > capacities[s][d] + 1e-9) {
        return {
          valid: false,
          reason: `F2: slot ${s} dim ${d} over capacity (${usage[s][d].toFixed(4)} > ${capacities[s][d]})`
        };
      }
    }
  }

  // F3: SLA window check
  for (let i = 0; i < n; i++) {
    const [lo, hi] = windows[i];
    if (assignment[i] < lo || assignment[i] > hi) {
      return {
        valid: false,
        reason: `F3: task ${i} in slot ${assignment[i]}, outside window [${lo},${hi}]`
      };
    }
  }

  return { valid: true, reason: null };
}

module.exports = { verify };
