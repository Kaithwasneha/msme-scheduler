'use strict';

const LAMBDA1 = 0.1;  // load imbalance weight
const LAMBDA2 = 0.05; // SLA urgency weight

/**
 * P(σ) = P_base + λ1×L(σ) + λ2×U(σ)
 *
 * P_base = Σ_i w_i × (σ(ti)+1)                 [1-indexed delay cost]
 * L(σ)   = Σ_s Σ_d [util(s,d) − avg_d]²         [load imbalance variance]
 * U(σ)   = Σ_i w_i × (σ(ti)−l_i)/(u_i−l_i+1)   [SLA urgency position]
 *
 * @param {number[]} assignment  - assignment[i] = slot index for task i
 * @param {number[]} weights
 * @param {Array}    windows     - windows[i] = [lo, hi]
 * @param {Array}    resources   - resources[i][d]
 * @param {Array}    capacities  - capacities[s][d]
 * @param {number}   K
 */
function computePenalty(assignment, weights, windows, resources, capacities, K) {
  const n = assignment.length;
  const D = capacities[0].length;

  // P_base: weighted sum of 1-indexed slot assignments
  let base = 0;
  for (let i = 0; i < n; i++) base += weights[i] * (assignment[i] + 1);

  // L(σ): load imbalance as sum of squared deviations from mean utilisation
  const util = Array.from({ length: K }, () => new Array(D).fill(0));
  for (let i = 0; i < n; i++) {
    const s = assignment[i];
    for (let d = 0; d < D; d++) util[s][d] += resources[i][d] / capacities[s][d];
  }
  const avgUtil = new Array(D).fill(0);
  for (let s = 0; s < K; s++) for (let d = 0; d < D; d++) avgUtil[d] += util[s][d] / K;
  let imbalance = 0;
  for (let s = 0; s < K; s++) {
    for (let d = 0; d < D; d++) {
      const delta = util[s][d] - avgUtil[d];
      imbalance += delta * delta;
    }
  }

  // U(σ): weighted SLA urgency — penalises high-weight tasks near deadline
  let urgencySum = 0;
  for (let i = 0; i < n; i++) {
    const [lo, hi] = windows[i];
    urgencySum += weights[i] * ((assignment[i] - lo) / (hi - lo + 1));
  }

  return base + LAMBDA1 * imbalance + LAMBDA2 * urgencySum;
}

module.exports = { computePenalty, LAMBDA1, LAMBDA2 };
