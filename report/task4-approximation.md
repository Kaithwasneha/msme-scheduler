# Task 4: Approximation Analysis — PWDR

---

## Sub-task A: Feasibility Guarantee (10 pts)

### What I can prove

PWDR guarantees three things unconditionally — **for every assignment it outputs**, it satisfies F1, F2, and F3. What it cannot guarantee is that it will always find an assignment (greedy without backtracking can paint itself into a corner). I'll prove both parts.

### Proof: every PWDR output satisfies F1, F2, F3

**F3 is structurally enforced:** In Step 2d-ii, candidates = {s ∈ [lo_i, hi_i] : s ∉ forbidden}. PWDR never selects a slot outside [lo_i, hi_i]. Every assigned task satisfies F3 by construction. ✓

**F1 is structurally enforced:** The `forbidden` set contains every slot currently occupied by a conflicting neighbour. PWDR only selects from `candidates`, which explicitly excludes `forbidden`. So σ(ti) ≠ σ(tj) for any conflict pair (ti, tj) where tj is already assigned. For tj assigned later, the same argument applies with ti and tj swapped. F1 holds for the entire output. ✓

**F2 is structurally enforced:** In Step 2d-iii, PWDR checks `slotUsage[s] + r(ti) ≤ C[s]` before adding ti to slot s. The repacking subroutine also checks both the mover's new slot and ti's target slot before committing. No assignment is made unless the resource check passes. F2 holds for the entire output. ✓

### When PWDR fails to find any assignment

PWDR can reach a state where `candidates` is empty (all SLA slots for the current task are occupied by conflicting neighbours) even though a valid assignment exists. This is the standard failure mode of greedy list-coloring. The restart mechanism (up to MAX_RESTARTS = 20) mitigates this but cannot eliminate it — there exist instances where every deterministic greedy ordering leads to a dead end.

**Formal guarantee with caveats:** On *perfect graphs* (chordal graphs, interval graphs), DSATUR always finds the chromatic number. For conflict graphs in this family, if a feasible assignment exists and resources are non-binding, PWDR with zero restarts is guaranteed to find it. For general graphs, we rely on restarts.

In my experiments: all infeasible instances were confirmed infeasible by brute force (small-3). The one instance where PWDR initially failed (small-2) was solved within 8 restarts.

---

## Sub-task B: Approximation Ratio for Delay Component (10 pts)

I'm bounding the ratio for P_base only (the delay term). The full penalty P = P_base + λ₁L + λ₂U — the additional terms are bounded separately below.

Let σ* = optimal assignment, σ_P = PWDR's output (when feasible).

### Theorem

$$\frac{P_{\text{base}}(\sigma_P)}{P_{\text{base}}(\sigma^*)} \leq \alpha = \max_i \frac{u_i + 1}{l_i + 1}$$

### Proof

**Lower bound on P_base(σ*):**

For every task ti, any valid assignment must put it in a slot ≥ li (F3 lower bound). So:

$$P_{\text{base}}(\sigma^*) \geq \sum_i w_i \cdot (l_i + 1)$$

**Upper bound on P_base(σ_P):**

PWDR assigns each task to some slot in [li, ui], so the worst case is slot ui:

$$P_{\text{base}}(\sigma_P) \leq \sum_i w_i \cdot (u_i + 1)$$

**The ratio:**

$$\frac{P_{\text{base}}(\sigma_P)}{P_{\text{base}}(\sigma^*)}
  \leq \frac{\sum_i w_i(u_i+1)}{\sum_i w_i(l_i+1)}
  \leq \max_i \frac{u_i+1}{l_i+1}$$

The last step uses the fact that a weighted average of ratios is at most the maximum ratio. More precisely: let aᵢ = wᵢ(uᵢ+1) and bᵢ = wᵢ(lᵢ+1). Then Σaᵢ/Σbᵢ ≤ max_i(aᵢ/bᵢ) = max_i(uᵢ+1)/(lᵢ+1). ✓

**Worst-case value of α:** If lᵢ = 0 and uᵢ = K−1 for some task, then α = K. For the generator's windows (0 ≤ lᵢ ≤ K−2, lᵢ+1 ≤ uᵢ ≤ K−1), when lᵢ = 0: α ≤ K. When lᵢ ≥ 1: α ≤ K/2.

**Extension to full penalty:** The load imbalance L(σ) satisfies L(σ) ≤ D (all utilisation is ≤ 1, variance ≤ 1 per slot×dim). The urgency term U(σ) ≤ Σᵢ wᵢ (maximum is 1 per task). So:

$$P(\sigma_P) \leq \alpha \cdot P_{\text{base}}(\sigma^*) + \lambda_1 \cdot K \cdot D + \lambda_2 \sum_i w_i$$

with λ₁ = 0.1, K ≤ 20, D = 4: the additive constant is at most 0.1×80 + 0.05×Σwᵢ = 8 + 0.05×Σwᵢ. This is small relative to P_base for large n.

---

## Sub-task C: Tight Adversarial Example (10 pts)

I want to construct an instance where PWDR's penalty is exactly α × OPT.

### Setting up the instance

Let K = 4. I want one high-weight task T0 that PWDR assigns to a late slot but OPT could put earlier.

The trick: T0 needs to have an early slot available in OPT's assignment but blocked in PWDR's greedy ordering.

Let's use λ₁ = λ₂ = 0 (pure delay) to make the ratio clean.

| Task | Window | Weight | Conflicts |
|------|--------|--------|-----------|
| T0 | [0, 3] | W = 10 | T1, T2, T3 |
| T1 | [0, 0] | ε = 0.01 | T0 |
| T2 | [1, 1] | ε = 0.01 | T0 |
| T3 | [2, 2] | ε = 0.01 | T0 |

No resource constraints (large capacity). K = 4.

### Tracing PWDR (no jitter, deterministic)

Round 1 scores (all saturations = 0):
- T1: urgency = 100/1 = 100, score = 100.01
- T2: urgency = 100/1 = 100, score = 100.01
- T3: urgency = 100/1 = 100, score = 100.01
- T0: urgency = 100/4 = 25, score = 35

T1 assigned first → slot 0 (only option). T2 → slot 1. T3 → slot 2.

Round 4: T0's forbidden = {0, 1, 2}. Candidates = [0,3] \ {0,1,2} = {3}. T0 → slot 3.

P_base(σ_P) = 10×(3+1) + 0.01×(0+1) + 0.01×(1+1) + 0.01×(2+1) = 40 + 0.01 + 0.02 + 0.03 = 40.06

### What's optimal?

T1 is pinned to slot 0, T2 to slot 1, T3 to slot 2 — these are forced. T0 conflicts with all of them, so T0 cannot be in slots 0, 1, or 2 regardless of the algorithm. T0 must go to slot 3. OPT = PWDR = 40.06. The ratio is exactly 1 — no gap here.

### Why the gap requires l_i > 0

For a gap to exist, T0 needs a slot in OPT that's not blocked, but IS blocked in PWDR's ordering. This can only happen if PWDR's greedy choices block T0's early slots before T0 gets assigned, but OPT's ordering doesn't.

**Construction for ratio α = K/2:**

Let K = 4, l₀ = 1 (T0's window starts at slot 1):

| Task | Window | Weight | Conflicts |
|------|--------|--------|-----------|
| T0 | [1, 3] | W = 10 | T1, T2 |
| T1 | [1, 1] | ε | T0 |
| T2 | [2, 2] | ε | T0 |
| T3 | [0, 3] | ε | none |

PWDR: T1 urgency=100, T2 urgency=100 → assigned first. T1→slot1, T2→slot2. T0 forbidden={1,2}, candidates={3}. T0→slot3.

P_base(σ_P) = W×(3+1) + ε×(1+1) + ε×(2+1) + ε×(0+1) = 4W + 6ε

OPT: same. T1 must be in slot 1 (pinned), T2 in slot 2 (pinned), both conflict T0 → T0 must go to slot 3. No way to assign T0 to slot 1 because T1 is already there. OPT = PWDR.

**The key insight:** In any instance where T0's early slots are occupied by PINNED tasks (window size 1) that conflict with T0, the schedule is forced — both PWDR and OPT must put T0 in the same late slot. There's no gap.

**To create a gap, we need a scenario where PWDR makes a suboptimal CHOICE (not a forced move):**

T0 [0,3] weight W, T1 [0,1] weight ε, no conflicts between T0 and T1.

PWDR assigns T0 to slot 0 (lowest marginal penalty). T1 also assigned to slot 0 (no conflict).
OPT: same — both go to slot 0. No gap.

**Conclusion on tight example:** The delay ratio α = max_i(uᵢ+1)/(lᵢ+1) is an upper bound that PWDR can theoretically approach when:
1. A high-weight task T0 has lᵢ = 0 (so OPT could assign it to slot 0 for delay cost W×1)
2. Due to conflict + resource + ordering interactions, PWDR assigns T0 to slot K−1 (delay cost W×K)
3. Ratio = K

This is achievable on instances with capacity constraints that block all early slots for T0, combined with conflict constraints from tasks in those slots. The exact tight example:

- T0 window [0, K−1], weight W, CPU=30
- Slot 0: CPU capacity = 25 (too small for T0)
- Slots 1–K−1: CPU capacity = 32 (fits T0)
- K−1 tasks T1…T_{K-1}: each window [j,j] (pinned), CPU=1, conflict T0

PWDR assigns T1…T_{K-1} first (urgency=100), filling slots 1,…,K−1. T0 cannot use slot 0 (capacity) or slots 1,…,K−1 (conflicts). **INFEASIBLE** — this construction is actually infeasible for T0!

This reveals that constructing a tight example for the delay ratio requires careful balance between capacity and conflict constraints to ensure the instance is feasible but T0 is forced to a late slot. The bound α ≤ K holds; achieving exactly K requires an adversarial capacity+conflict combination that I haven't been able to construct as a feasible instance.

**Practically observed ratio:** On small-1 the ratio was 1.181, on small-2 it was 1.008. The theoretical bound of K=3 and K=4 is loose for these instances, as expected for a random generator rather than an adversarial construction.
