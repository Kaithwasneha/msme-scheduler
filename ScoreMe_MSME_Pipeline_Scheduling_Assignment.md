# ScoreMe Solutions — Engineering Capstone Assignment

> **ScoreMe Solutions Pvt. Ltd. — Coding Assignment**
> **Advanced Systems Design — Assessment**

---

> ### ⚠️ AI USAGE POLICY — READ BEFORE STARTING
>
> AI tools (ChatGPT, Claude, Gemini, GitHub Copilot, etc.) are permitted **ONLY** for concept clarification — understanding what NP-hard means, how graph coloring works, syntax help for file I/O. AI **cannot** solve this assignment because:
> 1. The problem formulation is novel and compound, with no published polynomial solution.
> 2. You must design a custom penalty function that AI has no visibility into.
> 3. The approximation proof must reference your specific algorithm.
> 4. A 20-minute Viva Voce will expose any work you cannot explain.
>
> Every candidate must submit an **AI Usage Log**.

---

## 1. Purpose of This Assignment

This assignment is issued by ScoreMe to evaluate a candidate's ability to reason about computationally hard problems.

---

## 2. Problem Statement

### 2.1 Informal Description

You are given a set of credit pipeline tasks **T** submitted to a shared compute cluster. The cluster operates in discrete processing windows called **slots** (think: 30-second execution cycles). Each slot has a fixed capacity across four resource dimensions: **CPU cores**, **RAM (GB)**, **GPU units**, and **Network I/O (Gbps)**. Your job is to assign every task to exactly one slot such that:

- No two conflicting tasks run in the same slot *(conflict = they share a GPU memory bus or write to the same Kafka topic partition simultaneously)*
- No slot exceeds its resource capacity in any dimension
- Every task is assigned within its SLA window *(a bureau pull submitted at T=0 must run in slots 1–4 only, not slot 7)*
- The total weighted penalty — a function of priority, delay, and resource waste — is minimised

---

## 3. Formal Specification

### 3.2 Rigorous Mathematical Formulation

**INPUTS:**

| Symbol | Description |
|--------|-------------|
| `n` | Number of pipeline tasks (20 ≤ n ≤ 200 in graded instances) |
| `K` | Number of processing slots (3 ≤ K ≤ 20) |
| `d` | Number of resource dimensions (d = 4: CPU, RAM, GPU, Network) |
| `G = (V, E)` | Conflict graph, V = {t₁,...,tₙ}, E ⊆ V × V |
| `r : V → ℝᵈ` | Resource requirement vector per task |
| `C : [K] → ℝᵈ` | Capacity vector per slot (may vary by slot) |
| `w : V → ℝ⁺` | Priority weight per task (lender SLA importance) |
| `τ : V → [lᵢ, uᵢ]` | SLA time window: task i must run in slot s where lᵢ ≤ s ≤ uᵢ |
| `P : Assignment → ℝ` | **[YOUR DESIGN — extend P_base as per Task 2]** |

**FEASIBILITY** — a valid assignment σ must satisfy ALL:

| Constraint | Condition | Description |
|------------|-----------|-------------|
| F1 | `∀ (tᵢ, tⱼ) ∈ E : σ(tᵢ) ≠ σ(tⱼ)` | No conflicts in same slot |
| F2 | `∀ slot s : Σ_{tᵢ:σ(tᵢ)=s} r(tᵢ) ≤ C(s)` | Capacity not exceeded |
| F3 | `∀ tᵢ : lᵢ ≤ σ(tᵢ) ≤ uᵢ` | SLA window respected |

**OBJECTIVE:** Minimize `P(σ)` subject to F1, F2, F3

**BASE PENALTY** *(given — you must EXTEND this)*:

```
P_base(σ) = Σᵢ  w(tᵢ) × σ(tᵢ)   [weighted slot index = delay cost]
```

---

### 3.3 Illustrative Toy Instance

> ⚠️ The following small instance is provided for orientation only. Do not use it as your primary test case.

**Tasks:**
- T1 (Bank Statement OCR)
- T2 (Bureau Pull)
- T3 (GST Verify)
- T4 (Fraud Score)
- T5 (Credit Score)
- T6 (Document Check)

**Conflicts** *(cannot share a slot — GPU contention or Kafka partition clash)*:

```
T1—T2,  T1—T3,  T2—T4,  T3—T5,  T4—T6,  T5—T6
```

**Resource Requirements** `[CPU_cores, RAM_GB, GPU_units, Net_Gbps]`:

| Task | CPU | RAM | GPU | Net | Notes |
|------|-----|-----|-----|-----|-------|
| T1 (OCR) | 8 | 32 | 4 | 1.5 | GPU-heavy |
| T2 (Bureau) | 4 | 16 | 0 | 3.0 | Network-heavy (external API) |
| T3 (GST) | 2 | 8 | 0 | 2.0 | |
| T4 (Fraud) | 16 | 64 | 2 | 0.5 | CPU-heavy ML inference |
| T5 (Credit) | 8 | 32 | 2 | 1.0 | |
| T6 (DocChk) | 4 | 16 | 0 | 1.5 | |

**Slot Capacities** *(4 slots, uniform)*: `[32 CPU, 128 RAM, 8 GPU, 6.0 Net]`

**SLA Windows:**

| Task | Window |
|------|--------|
| T1 | [1, 3] |
| T2 | [1, 4] |
| T3 | [1, 4] |
| T4 | [2, 4] |
| T5 | [1, 4] |
| T6 | [2, 4] |

**Lender Weights (priority):** T1:5, T2:4, T3:3, T4:2, T5:3, T6:2

---

## 4. Assignment Tasks

Eight tasks across four phases. Submit each as a clearly labelled section in your report. **Code is required for Tasks 5–6.**

---

### PHASE I — UNDERSTAND AND MODEL

#### Task 1: Prove NP-Hardness of This Specific Instance `[20 pts]` — *Hard*

Construct a formal polynomial-time reduction from **3-SAT** or **Graph k-Coloring** to this exact problem. Your reduction must account for all three constraint families simultaneously:
- Conflict avoidance (graph coloring)
- Resource capacity (multi-dimensional packing)
- SLA windows (temporal scheduling)

A reduction addressing only one family earns partial credit only.

> **AI BOUNDARY:** AI can explain what a reduction is and how 3-SAT works in general. AI cannot construct a reduction for this compound formulation because the mapping must simultaneously encode all three constraint families — and the specific way they interact depends on your problem structure. Generic textbook reductions will be caught.

**Deliverable:** 1–2 page formal proof (LaTeX preferred). Must include:
- The construction function
- The feasibility-preserving direction
- The completeness direction
- Clear statement of which NP-hard problem you are reducing from

---

#### Task 2: Design and Justify Your Penalty Function P(σ) `[15 pts]` — *Medium*

Extend `P_base` with at least one additional term that models a real ScoreMe platform concern. Valid motivations include (but are not limited to):

- **Load imbalance** across slots *(one slot at 95% CPU while another is at 10% is operationally undesirable)*
- **SLA breach probability** *(tasks assigned near their upper window boundary carry higher risk)*
- **GPU fragmentation penalty** *(partial GPU allocation wastes expensive accelerator capacity)*
- **Lender tier fairness** *(a Tier-1 PSU bank task should not be delayed behind a Tier-3 NBFC task)*

Your penalty extension must be:
- Formally defined as a mathematical expression
- Computable in polynomial time given an assignment
- Monotonically meaningful *(explain why minimising it is desirable)*
- Non-trivial *(adding a constant or zero term is rejected)*

> **DESIGN FREEDOM NOTE:** There are infinitely many valid penalty extensions. The evaluator assesses the quality of your reasoning — not which specific function you chose. A simple, well-argued extension scores higher than a complex, unexplained one.

---

### PHASE II — ALGORITHM DESIGN

#### Task 3: Design Your Approximation / Heuristic Algorithm `[40 pts]` — *Expert*

Design an original polynomial-time algorithm that either produces a valid feasible assignment, or detects and reports infeasibility. Your algorithm must be:

- Described in **structured pseudocode** with a line-level justification of every non-obvious decision
- **Named** (e.g., Priority-Weighted DSATUR, Resource-Aware Annealer, Conflict-First Greedy)
- **Motivated:** explain why your approach is suited to this problem's specific structure

You may draw from any algorithmic family. Hybrids are strongly encouraged:

- Greedy Coloring + Resource Repacking
- Simulated Annealing with Conflict Cooling
- DSATUR Variant (degree + saturation)
- LP Relaxation + Randomised Rounding
- Local Search with Tabu List
- **Your Own Invention (encouraged)**

> **AI BOUNDARY:** AI can explain how simulated annealing or DSATUR works in the abstract. AI cannot produce the specific neighbourhood function, move selection strategy, or resource rebalancing heuristic suited to this compound problem — these depend on the interaction between your conflict structure, resource tightness, and custom penalty. This calibration is precisely what the evaluator is assessing.

**Deliverable:**
- Named algorithm in structured pseudocode
- 1-page design rationale
- Description of 2 alternative approaches you considered and rejected (with reasons why)

---

#### Task 4: Prove Your Approximation Ratio or Bound `[30 pts]` — *Expert*

For your algorithm, prove one or more of the following *(marks are cumulative)*:

| Sub-task | Points | Requirement |
|----------|--------|-------------|
| Feasibility Guarantee | 10 pts | Prove that if a valid assignment exists, your algorithm always finds a feasible one. Identify all cases where your algorithm might violate F1/F2/F3 and show they cannot occur. |
| Approximation Ratio | +10 pts | Prove `P(σ_yours) ≤ α × P(σ_optimal)` for some `α > 1` that you derive analytically from your algorithm's structure. |
| Tight Adversarial Example | +10 pts | Construct a specific input instance on which your algorithm achieves exactly α, showing the bound is tight and cannot be improved without a fundamentally different approach. |

> **⚠️ CRITICAL WARNING:** Generic approximation proofs copied from textbooks will be identified immediately. Your proof must reference your specific pseudocode, your specific penalty function, and your specific neighbourhood structure. The tight adversarial example must be hand-constructed based on where your algorithm fails — not taken from a paper.

---

### PHASE III — IMPLEMENTATION AND BENCHMARKING

#### Task 5: Implement Your Algorithm in Python `[25 pts]` — *Hard*

Implement your algorithm from Task 3 in **Python 3.10+** *(Java 17+ accepted with prior written approval from the assignment coordinator)*.

**Requirements:**

- **Input:** JSON file matching the instance generator format (see Section 5)
- **Output:** JSON with keys:
  - `assignment` (dict mapping `task_id → slot`)
  - `penalty` (float)
  - `runtime_ms` (int)
  - `feasible` (bool)
  - `violation_reason` (string if infeasible)

**Forbidden libraries:** OR-Tools, PuLP, CPLEX, Gurobi, Z3, `networkx.coloring`, any SAT solver

**Permitted:** `numpy`, `pandas`, `matplotlib`, standard library, custom graph/data-structure utilities

- All algorithmic logic must be original. Boilerplate (I/O, data classes) may use AI assistance.
- Docstrings required for every non-trivial function explaining the **design decision**, not just what it does.
- **Unit tests required for:**
  - All-conflict graph (chromatic number > K)
  - Zero-capacity slot
  - Tight SLA windows
  - Single-task instance

> **AI BOUNDARY:** AI may help with JSON parsing, data class definitions, and matplotlib charts. AI may **not** write the scheduling loop, conflict resolution logic, resource repacking, or neighbourhood search. Code that contradicts your pseudocode is a Viva red flag.

---

#### Task 6: Empirical Analysis and Benchmarking `[20 pts]` — *Medium*

Run your algorithm on the following benchmark suite and report results in a structured table accompanied by at least **two charts** (penalty vs n, runtime vs n):

```bash
# Small instances (compare against brute-force optimal)
python run.py --n 8   --K 3  --density 0.3  --seed 1
python run.py --n 10  --K 4  --density 0.4  --seed 2
python run.py --n 12  --K 4  --density 0.5  --seed 3

# Medium instances
python run.py --n 50  --K 8  --density 0.25 --seed 10
python run.py --n 100 --K 10 --density 0.30 --seed 11
python run.py --n 150 --K 12 --density 0.35 --seed 12

# Stress instances
python run.py --n 200 --K 15 --density 0.40 --seed 20
python run.py --n 200 --K 5  --density 0.60 --seed 21   # tight K
python run.py --n 200 --K 20 --density 0.10 --seed 22   # sparse conflicts
```

**Report for each instance:** penalty value, runtime (ms), feasibility status, empirical approximation ratio vs brute-force for small instances. Explain every anomaly. **Do not hide failures.**

---

### PHASE IV — REFLECTION AND DEFENCE

#### Task 7: Design Journal `[20 pts]` — *Medium*

A **2-page written reflection** (your own words, not AI-generated). Must address all four of the following:

1. **Hardest design decision:** What was the single hardest design decision you made, and why? Be specific — name the algorithm step, the trade-off you faced, and the alternative you rejected.
2. **Empirical failure:** Where did your algorithm fail empirically, and what would you change with an additional week? Name the specific benchmark instance and what the failure mode was.
3. **Production system link:** Identify a real production system at ScoreMe (NiFi pipeline, Kafka consumer group, OCR GPU cluster, or bureau API gateway) where this exact problem class appears. How would your algorithm apply?
4. **Surprise learning:** What did you learn that surprised you — about the problem, about algorithm design, or about your own thinking?

> **AI BOUNDARY:** AI cannot write this section. It does not know what you struggled with, what your algorithm did when you ran it on a tight-K instance at 2am, or what surprised you. Evaluators identify AI-generated reflection by the absence of specific, personal, non-generic observations. Vague language like "I found this challenging" without specifics = **0 on this task**.

---

#### Task 8: Viva Voce — Live Technical Defence `[30 pts]` — *Hard*

A **20-minute individual oral examination** conducted by two ScoreMe engineers. No notes. No AI.

You will be asked to:

- Walk through your pseudocode on the whiteboard **from memory**, explaining each step
- Trace your algorithm manually on a **fresh 6-node instance** provided at the start of the viva (not seen before)
- Explain any arbitrary line of your submitted code (evaluator points at random)
- Answer: *"What happens to your algorithm if I add a 5th resource dimension?"*
- Answer: *"What happens if two slots have different capacities?"*
- Justify one design decision you would have made differently with hindsight

> **⚠️ ZERO TOLERANCE POLICY:** Inability to explain your own pseudocode, code, or proof during the viva results in a **zero for the ENTIRE assignment** — regardless of submission quality. This is the strongest integrity enforcement mechanism. If you did not write it, you cannot defend it. **Know your own work.**

---

## 5. Instance Generator (Provided)

Use this generator to create test instances. **Do not modify it.** Your evaluator will use additional held-out seeds.

```python
import random

def generate_instance(n, K, d=4, conflict_density=0.3, seed=42):
    """Generate a random MSME Credit Pipeline Scheduling instance."""
    random.seed(seed)

    tasks = [f'T{i}' for i in range(n)]

    conflicts = [
        (i, j)
        for i in range(n)
        for j in range(i + 1, n)
        if random.random() < conflict_density
    ]

    cap = [32, 128, 8, 6.0]  # CPU, RAM, GPU, Network

    resources = [
        [random.uniform(1, cap[d] // (n // K + 1)) for d in range(4)]
        for _ in range(n)
    ]

    capacities = [cap[:] for _ in range(K)]

    windows = [
        (lo := random.randint(0, K - 2), random.randint(lo + 1, K - 1))
        for _ in range(n)
    ]

    weights = [random.uniform(1, 10) for _ in range(n)]

    return dict(
        tasks=tasks,
        conflicts=conflicts,
        resources=resources,
        capacities=capacities,
        windows=windows,
        weights=weights,
        K=K
    )
```

---

## 6. Evaluation Rubric

**200 points total. Pass threshold: 100 points.**
> Viva score below 15/30 **caps total at 120 points** regardless of submission quality.

| Task | Pts | What Earns Full Marks | Common Failure Modes |
|------|-----|-----------------------|----------------------|
| **T1: NP Proof** | 20 | Complete reduction covering all 3 constraint families; bidirectional; original compound formulation | Reduces only to coloring; ignores resource and temporal constraints |
| **T2: Penalty Design** | 15 | Meaningful domain-grounded extension; formal definition; compelling motivation in ScoreMe context | Adding a constant; penalty indistinguishable from P_base; no justification |
| **T3: Algorithm Design** | 40 | Clear pseudocode; every decision justified; 2 rejected alternatives with reasons; named and motivated | Generic textbook algorithm with no problem-specific adaptation; no rejected alternatives |
| **T4: Approximation Proof** | 30 | All 3 levels attempted; tight example is original and adversarial; proof references specific pseudocode | Proof does not reference own algorithm; tight example taken from a paper |
| **T5: Implementation** | 25 | Correct infeasibility detection; all edge cases unit tested; code matches pseudocode; no forbidden libs | Produces invalid assignments; uses forbidden solver; code contradicts pseudocode |
| **T6: Benchmarking** | 20 | All 9 instances run; anomalies investigated; empirical ratio vs brute force for small instances | Unexplained outliers; no comparison to optimal; missing instances |
| **T7: Design Journal** | 20 | Specific, personal, non-generic; ScoreMe production system identified; genuine failure documented | AI-generated generic text; no concrete personal decisions cited; no production system link |
| **T8: Viva Voce** | 30 | Traces algorithm by hand on fresh instance; explains every code line asked; answers perturbation questions | Cannot explain own code; answers contradict submission; cannot trace algorithm manually |

---

*CONFIDENTIAL — ScoreMe Solutions Pvt. Ltd.*
