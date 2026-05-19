'use strict';
const { computePenalty, LAMBDA1, LAMBDA2 } = require('./penalty');
const { createRNG } = require('./rng');

/**
 * PWDR: Priority-Weighted DSATUR with Resource Repacking
 *
 * Ordering: score(ti) = 100×saturation + 100×urgency + weight + jitter
 *   saturation = distinct slots used by already-assigned conflicting neighbours
 *   urgency    = 1/(window_size) — tight SLA window → assign early
 *   jitter     = tiny random perturbation for restart diversity
 *
 * Saturation (100) dominates; urgency (100/window_size, max 100) breaks early
 * ties so single-slot-window tasks always beat high-weight unconstrained tasks.
 *
 * Slot selection: argmin marginal penalty (delay + urgency + imbalance delta).
 *
 * Repacking: depth-1 swap when no slot has sufficient capacity.
 *
 * Restarts: greedy can paint itself into a corner on feasible instances.
 * If the primary run fails, up to MAX_RESTARTS retries with jittered scoring.
 */

const MAX_RESTARTS = 20;

function schedule(instance) {
  const startTime = Date.now();

  // Primary run (deterministic, jitter seed = 0 means no jitter)
  const primary = pwdrOnce(instance, 0, startTime);
  if (primary.feasible) return primary;

  // Restart with different jitter seeds to escape bad greedy orderings
  for (let seed = 1; seed <= MAX_RESTARTS; seed++) {
    const r = pwdrOnce(instance, seed, startTime);
    if (r.feasible) return r;
  }

  // All restarts exhausted — report infeasible from primary attempt
  return { ...primary, runtime_ms: Date.now() - startTime };
}

function pwdrOnce(instance, jitterSeed, startTime) {
  const { tasks, conflicts, resources, capacities, windows, weights, K } = instance;
  const n = tasks.length;
  const D = capacities[0].length;

  const rng = jitterSeed > 0 ? createRNG(jitterSeed * 997 + 31) : null;

  const adj = Array.from({ length: n }, () => new Set());
  for (const [i, j] of conflicts) { adj[i].add(j); adj[j].add(i); }

  const slotUsage = Array.from({ length: K }, () => new Float64Array(D));
  const assignment = new Array(n).fill(-1);
  const unassigned = new Set(Array.from({ length: n }, (_, i) => i));

  function saturation(ti) {
    const seen = new Set();
    for (const j of adj[ti]) { if (assignment[j] >= 0) seen.add(assignment[j]); }
    return seen.size;
  }

  function forbiddenSlots(ti) {
    const f = new Set();
    for (const j of adj[ti]) { if (assignment[j] >= 0) f.add(assignment[j]); }
    return f;
  }

  function resourceFits(s, ti) {
    for (let d = 0; d < D; d++) {
      if (slotUsage[s][d] + resources[ti][d] > capacities[s][d] + 1e-9) return false;
    }
    return true;
  }

  function marginalPenalty(ti, s) {
    const [lo, hi] = windows[ti];
    const delayTerm    = weights[ti] * (s + 1);
    const urgencyTerm  = LAMBDA2 * weights[ti] * ((s - lo) / (hi - lo + 1));
    let imbalanceDelta = 0;
    for (let d = 0; d < D; d++) {
      const before = slotUsage[s][d] / capacities[s][d];
      const after  = (slotUsage[s][d] + resources[ti][d]) / capacities[s][d];
      imbalanceDelta += after * after - before * before;
    }
    return delayTerm + urgencyTerm + LAMBDA1 * imbalanceDelta;
  }

  function tryRepacking(ti, candidates) {
    for (const targetSlot of candidates) {
      const residents = [];
      for (let k = 0; k < n; k++) { if (assignment[k] === targetSlot) residents.push(k); }

      for (const mover of residents) {
        const [mlo, mhi] = windows[mover];
        const moverForbidden = new Set();
        for (const nb of adj[mover]) {
          if (assignment[nb] >= 0 && nb !== ti) moverForbidden.add(assignment[nb]);
        }

        for (let alt = mlo; alt <= mhi; alt++) {
          if (alt === targetSlot || moverForbidden.has(alt)) continue;
          let altFits = true;
          for (let d = 0; d < D; d++) {
            if (slotUsage[alt][d] + resources[mover][d] > capacities[alt][d] + 1e-9) {
              altFits = false; break;
            }
          }
          if (!altFits) continue;
          let tiFits = true;
          for (let d = 0; d < D; d++) {
            const newUsage = slotUsage[targetSlot][d] - resources[mover][d] + resources[ti][d];
            if (newUsage > capacities[targetSlot][d] + 1e-9) { tiFits = false; break; }
          }
          if (!tiFits) continue;
          for (let d = 0; d < D; d++) {
            slotUsage[targetSlot][d] -= resources[mover][d];
            slotUsage[alt][d]        += resources[mover][d];
          }
          assignment[mover] = alt;
          return [targetSlot];
        }
      }
    }
    return [];
  }

  while (unassigned.size > 0) {
    let bestTask = -1, bestScore = -Infinity;
    for (const i of unassigned) {
      const [lo, hi] = windows[i];
      // jitter range ±60 is large enough to reorder tasks with urgency up to 100
      const jitter = rng ? rng.uniform(-60, 60) : 0;
      const score  = 100 * saturation(i) + 100 * (1 / (hi - lo + 1)) + weights[i] + jitter;
      if (score > bestScore) { bestScore = score; bestTask = i; }
    }

    const ti = bestTask;
    const [lo, hi] = windows[ti];
    const forbidden = forbiddenSlots(ti);

    const candidates = [];
    for (let s = lo; s <= hi; s++) { if (!forbidden.has(s)) candidates.push(s); }

    if (candidates.length === 0) {
      return {
        assignment: null, penalty: null, feasible: false,
        runtime_ms: Date.now() - startTime,
        violation_reason: `Task ${tasks[ti]}: all SLA slots [${lo},${hi}] blocked by conflicts`
      };
    }

    let feasible = candidates.filter(s => resourceFits(s, ti));

    if (feasible.length === 0) {
      feasible = tryRepacking(ti, candidates);
    }

    if (feasible.length === 0) {
      return {
        assignment: null, penalty: null, feasible: false,
        runtime_ms: Date.now() - startTime,
        violation_reason: `Task ${tasks[ti]}: no feasible slot after repacking`
      };
    }

    let bestSlot = feasible[0], bestMP = Infinity;
    for (const s of feasible) {
      const mp = marginalPenalty(ti, s);
      if (mp < bestMP) { bestMP = mp; bestSlot = s; }
    }

    assignment[ti] = bestSlot;
    for (let d = 0; d < D; d++) slotUsage[bestSlot][d] += resources[ti][d];
    unassigned.delete(ti);
  }

  const assignMap = {};
  for (let i = 0; i < n; i++) assignMap[tasks[i]] = assignment[i];
  const p = computePenalty(assignment, weights, windows, resources, capacities, K);

  return { assignment: assignMap, penalty: p, feasible: true, violation_reason: null, runtime_ms: Date.now() - startTime };
}

module.exports = { schedule };
