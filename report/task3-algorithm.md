# Task 3: Algorithm Design — PWDR

## Algorithm Name

**PWDR — Priority-Weighted DSATUR with Resource Repacking**

---

## Why this approach

When I first looked at this problem I thought: F1 is graph coloring, F2 is bin packing, F3 is interval scheduling. All three are individually NP-hard. The challenge is that they interact — you can't optimise them separately.

My first instinct was simulated annealing. But after thinking about it I realised SA has a problem for this assignment: you can't prove an approximation ratio for a randomised algorithm that doesn't have a fixed termination condition, and the viva asks me to explain any arbitrary line of code from memory. SA's neighbour-selection logic and cooling schedule would be hard to justify rigorously.

DSATUR (Degree SAT URation) is the strongest known greedy algorithm for graph coloring. The key insight is: assign the vertex that has the most "saturated" neighbourhood — the most distinct colors already used by its assigned neighbours. This minimises the chance you'll create a coloring conflict by using up colors prematurely.

I adapted DSATUR for this problem by:
1. Adding an urgency term so tasks with tight SLA windows (small window size) get assigned before they're blocked
2. Choosing slots by minimising marginal penalty (not just "first feasible")
3. Adding a depth-1 repacking step for when capacity is tight
4. Adding random restarts to escape bad greedy orderings (discovered this was necessary empirically — see Design Journal)

---

## Pseudocode

```
Algorithm PWDR(instance):
  Input:  n tasks, conflict list, resources[n][4], capacities[K][4],
          windows[n] = [(lo,hi)], weights[n], K
  Output: assignment σ : tasks → {0…K−1}, P(σ), or INFEASIBLE

  // Build adjacency set for O(deg) conflict lookups
  1.  For each conflict (i,j): adj[i].add(j); adj[j].add(i)

  // Try up to MAX_RESTARTS orderings
  2.  For pass = 0 to MAX_RESTARTS:
      a.  Reset slotUsage[K][4] ← 0,  assignment[n] ← UNSET
      b.  If pass > 0: init RNG with seed = pass (for jitter)
      c.  unassigned ← {0,…,n−1}

      d.  While unassigned ≠ ∅:

          // Step 1: Select next task to assign
          For each i ∈ unassigned:
            sat(i)     ← |{σ(j) : j ∈ adj[i], j assigned}|
            urgency(i) ← 1 / (windows[i].hi − windows[i].lo + 1)
            jitter(i)  ← Uniform(−60, +60)   // only if pass > 0
            score(i)   ← 100·sat(i) + 100·urgency(i) + weights[i] + jitter(i)
          Select ti ← task with highest score

          // Step 2: Find valid slots — satisfying F1 and F3
          forbidden  ← {σ(j) : j ∈ adj[ti], j assigned}        // F1
          candidates ← {s ∈ [lo_i, hi_i] : s ∉ forbidden}      // F3 ∩ ¬conflict

          If candidates = ∅:
            break  // this ordering fails here

          // Step 3: Filter by F2 (resource capacity)
          feasible ← {s ∈ candidates : slotUsage[s] + r(ti) ≤ C[s]}

          // Step 4: Repacking fallback
          If feasible = ∅:
            feasible ← REPACK(ti, candidates)
            If feasible = ∅: break

          // Step 5: Assign to slot minimising marginal penalty
          s* ← argmin_{s ∈ feasible} MarginalPenalty(ti, s)
          σ(ti) ← s*
          slotUsage[s*] += r(ti)
          unassigned.delete(ti)

      e.  If unassigned = ∅:
            Return (σ, P(σ), feasible=true)

  3.  Return (INFEASIBLE, last violation reason)


Subroutine REPACK(ti, candidates):
  // Depth-1: try moving one resident task to free up capacity
  For targetSlot ∈ candidates:
    For mover ∈ tasks currently in targetSlot:
      moverForbidden ← {σ(k) : k ∈ adj[mover], k ≠ ti}
      For alt ∈ [lo_mover, hi_mover] \ ({targetSlot} ∪ moverForbidden):
        If mover fits in alt (F2 check):
          If ti fits in targetSlot after removing mover (F2 check):
            Move mover to alt; update slotUsage
            Return [targetSlot]
  Return []


Function MarginalPenalty(ti, s):
  delay     ← weights[ti] × (s + 1)
  urgency   ← λ₂ × weights[ti] × (s − lo_i) / (hi_i − lo_i + 1)
  imbalance ← λ₁ × Σ_d [ (util(s,d) + r(ti,d)/C[s][d])² − util(s,d)² ]
  Return delay + urgency + imbalance
```

---

## Why each non-obvious decision was made

**Saturation coefficient = 100:**
This makes saturation dominate the ordering in later rounds (when some tasks are assigned and saturation > 0). Pure DSATUR behaviour kicks in once conflicts start forming. In round 1 when all saturations are 0, urgency and weight determine the order.

**Urgency coefficient = 100:**
The urgency of a size-1 window is 100/1 = 100. The maximum weight contribution is 10. This ensures a task pinned to a single slot (like T3 in the benchmark spec) always gets assigned before an unconstrained task with high lender priority. Without this, a weight-8 task with window size 4 would outscore a weight-1 task with window size 1, and PWDR would try to assign the weight-8 task first, possibly locking out the pinned task.

I discovered this empirically — see Design Journal section 1 for the full story.

**Jitter range = ±60:**
Matches the scale of the urgency scores (max contribution 100). A jitter of ±0.4 was completely ineffective — the task ordering was identical across all restarts because the jitter was smaller than the floating-point differences between scores. See Design Journal section 4.

**Depth-1 repacking only:**
A depth-2 or depth-3 repack would be correct more often, but the cost grows as O(residents^depth × K). Depth-1 is O(residents × K) per call — bounded and predictable. In practice, if one swap doesn't work, a different restart ordering usually finds a route that doesn't need repacking at all.

**Marginal penalty for slot selection:**
I initially tried always picking the earliest feasible slot. This minimised delay but caused the load imbalance term to blow up — all tasks ended up in slot 0, which has terrible L(σ). Marginal penalty selection naturally trades off delay vs. balance.

---

## Complexity

One pass through the outer loop: O(n² × deg_avg + n × K) where deg_avg is the average conflict degree.

For n=200, deg_avg=80, K=20: ≈ 3.2M + 4K operations per pass, ×20 restarts = ~64M ops total. Runs in under 50ms in practice.

---

## Two alternatives I seriously considered and rejected

### Simulated Annealing

I read about SA specifically for graph colouring (Kirkpatrick et al.) and it does produce better quality solutions on large instances because it can escape local minima. I even sketched a neighbourhood function: swap two tasks between slots if the swap doesn't create a conflict.

I rejected it for three reasons:
1. **Non-deterministic.** I can't reproduce the exact output for a given input without the random seed, which is operationally awkward for credit pipeline decisions. Two runs on the same instance produce different assignments with different penalties.
2. **No approximation ratio.** The assignment asks me to prove a bound in Task 4. SA doesn't lend itself to analytic bounds — the quality depends on the cooling schedule and number of iterations, not the problem structure.
3. **Viva risk.** If asked to trace SA on a fresh 6-node instance at the whiteboard, I'd have to simulate random number generation by hand to show the exact sequence of accepted/rejected moves. That's not tractable.

### LP Relaxation + Rounding

The idea: relax σ(tᵢ) ∈ {0,…,K−1} to xᵢₛ ∈ [0,1] (fractional assignment), solve the LP, then round. OR-Tools can do this in milliseconds.

I rejected it because OR-Tools is explicitly forbidden. Implementing a simplex from scratch is far out of scope. And rounding is fundamentally problematic for the conflict constraint — you can't guarantee two conflicting tasks round to different slots, and the LP's fractional solution might assign 0.5 of task T1 to each of slots 1 and 2, which is meaningless for a scheduling problem.

---

## Benchmark Results (Task 6)

| Instance | n | K | ρ | Feasible? | Penalty | ms | Ratio vs OPT |
|----------|---|---|---|-----------|---------|-----|--------------|
| small-1 | 8 | 3 | 0.3 | YES | 101.59 | 1 | 1.181 |
| small-2 | 10 | 4 | 0.4 | YES | 174.51 | 1 | 1.008 |
| small-3 | 12 | 4 | 0.5 | **NO** | — | 2 | brute-force confirms infeasible |
| medium-1 | 50 | 8 | 0.25 | NO | — | 6 | — |
| medium-2 | 100 | 10 | 0.3 | NO | — | 12 | — |
| medium-3 | 150 | 12 | 0.35 | NO | — | 19 | — |
| stress-1 | 200 | 15 | 0.4 | NO | — | 38 | — |
| stress-2 (tight K) | 200 | 5 | 0.6 | NO | — | 34 | — |
| stress-3 (sparse) | 200 | 20 | 0.1 | NO | — | 23 | — |

**Why so many infeasible?** The generator's SLA window distribution gives each task an average of approximately K/3 valid slots. For K=8, that's roughly 2.7 slots per task, while average conflict degree is 0.25 × 49 ≈ 12. A task with 12 conflicting neighbours and only 2.7 valid slots almost certainly has some neighbor in every valid slot. This is infeasibility in the *list-coloring* sense, not a PWDR failure. The brute-force confirmation on small-3 validates this. For medium and stress instances I can't brute-force verify, but the same structural argument applies.

To produce feasible benchmark instances, the generator should either increase K or shrink the conflict density. With K=2n and density=0.1, instances are reliably feasible.
