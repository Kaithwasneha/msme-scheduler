# Task 1: NP-Hardness of MSME Pipeline Scheduling

## Claim

MSME Pipeline Scheduling is NP-complete.

---

## Which problem I'm reducing from

I'm reducing from **Graph k-Coloring**, which is NP-complete for k ≥ 3 (this is one of Karp's original 21 NP-complete problems).

The problem is: given an undirected graph G = (V, E) and an integer k, does a valid k-coloring exist — a function c : V → {1,…,k} such that no two adjacent vertices share the same color?

I chose this reduction because the conflict constraint F1 (no two conflicting tasks in the same slot) is structurally identical to the graph coloring constraint. The reduction almost writes itself.

---

## The Construction

Given ⟨G = (V, E), k⟩, I build MSME instance I as follows:

**Tasks:** One task tᵢ per vertex vᵢ. So n = |V|.

**Slots:** K = k.

**Conflict graph:** Edges E map directly — for each (vᵢ, vⱼ) ∈ E, add conflict pair (tᵢ, tⱼ).

**Resources:** Each task needs r(tᵢ) = [1, 1, 0, 0] (1 CPU, 1 RAM).

**Capacities:** Each slot gets C(s) = [n, n, 8, 6] — enough room for all n tasks simultaneously.

**SLA windows:** τ(tᵢ) = [0, K−1] for every task — the full range, no restriction.

**Weights:** w(tᵢ) = 1 for all tasks (irrelevant for feasibility).

This takes O(|V| + |E|) time. Polynomial. ✓

**Why I built F2 and F3 this way:**

I could have made the resource and SLA constraints trivially satisfied so the reduction "only uses F1," but that would be reducing to a *simpler variant* of the problem, not to MSME Pipeline Scheduling itself. By including F2 and F3 in the construction (even if non-binding), the reduction is to the actual compound three-constraint problem. If a reduction to MSME exists, and MSME requires F1 ∧ F2 ∧ F3, then the reduction must produce instances where all three are present.

---

## Completeness: valid coloring → valid assignment

Say G has a valid k-coloring c : V → {1,…,k}. Define σ(tᵢ) = c(vᵢ) − 1.

- **F1:** For any conflict (tᵢ, tⱼ), edge (vᵢ, vⱼ) ∈ E exists, so c(vᵢ) ≠ c(vⱼ), so σ(tᵢ) ≠ σ(tⱼ). ✓
- **F2:** CPU usage per slot ≤ n × 1 = n ≤ n (capacity). Same for RAM. GPU and Net requirements are 0. ✓
- **F3:** σ(tᵢ) = c(vᵢ) − 1 ∈ {0,…,k−1} = [0, K−1]. Every task is within its window. ✓

So any valid coloring gives a valid MSME assignment. □

---

## Soundness: valid assignment → valid coloring

Say σ is a valid MSME assignment. Define c(vᵢ) = σ(tᵢ) + 1.

- c maps to {1,…,K} = {1,…,k} because F3 ensures σ(tᵢ) ∈ [0, K−1]. ✓
- For any edge (vᵢ, vⱼ) ∈ E, we have conflict (tᵢ, tⱼ), so F1 gives σ(tᵢ) ≠ σ(tⱼ), so c(vᵢ) ≠ c(vⱼ). ✓

So any valid assignment gives a valid coloring. □

---

## MSME is in NP

Given a candidate assignment σ, I can verify it in polynomial time:
- F1: check all conflict pairs — O(|E|)
- F2: accumulate per-slot resource usage — O(n × d)
- F3: check each task's window — O(n)

Total: O(n·d + |E|). Polynomial. ✓

---

## Conclusion

Graph k-Coloring ≤ₚ MSME Pipeline Scheduling, and MSME ∈ NP.
Since Graph k-Coloring is NP-complete, **MSME Pipeline Scheduling is NP-complete**. □

This justifies why I'm using a heuristic (PWDR) instead of an exact solver — no polynomial-time exact algorithm exists unless P = NP.
