# Task 2: Penalty Function Design

## The Base Penalty (given)

$$P_{\text{base}}(\sigma) = \sum_{i=1}^{n} w(t_i) \cdot (\sigma(t_i) + 1)$$

I'm using 1-indexed slots (add 1 to the slot index) so that the first slot carries a cost of 1 rather than 0 — otherwise tasks in slot 0 would contribute nothing to the penalty, which makes no sense as a delay measure. This is the weighted sum of how late each task runs, scaled by its priority.

The problem with only using P_base is that it says nothing about how the cluster is actually being used. Two schedules can have the same total delay but one might have slot 2 completely saturated and slot 4 empty, while the other is perfectly balanced. From an operations perspective, the first schedule is much worse.

---

## My First Extension: Load Imbalance L(σ)

### Definition

$$L(\sigma) = \sum_{s=0}^{K-1} \sum_{d=0}^{3}
  \left[\,\text{util}(s,d) - \bar{u}_d\,\right]^2$$

where utilisation and its mean are:

$$\text{util}(s,d) = \frac{\sum_{t_i : \sigma(t_i)=s} r(t_i, d)}{C(s, d)},
\qquad
\bar{u}_d = \frac{1}{K}\sum_{s}\text{util}(s,d)$$

This is the sum of squared deviations from average utilisation, computed separately for each of the four resource dimensions.

### Why I chose this

The ScoreMe OCR GPU cluster runs T1 (Bank Statement OCR) tasks that are GPU-heavy and T4 (Fraud Score) tasks that are CPU-heavy. If a greedy scheduler packs all the GPU work into slot 2, that slot is a hotspot — it can't absorb any retries if something fails, and the lender's SLA might breach. Meanwhile slots 3 and 4 are sitting mostly idle.

L(σ) directly penalises this. If all GPU tasks pile into one slot, util(2, GPU) is high while util(3,GPU) and util(4,GPU) are near zero — the variance term blows up. The scheduler is incentivised to spread GPU load evenly.

Choosing the sum-of-squares rather than, say, max deviation means every imbalanced slot contributes to the penalty, not just the worst one. I think that's more honest — five slots at 60% is worse than one slot at 80% even though the max is lower.

### Properties

- Computable in O(n·d + K·d) — one pass to build `util`, one pass to compute variance. Polynomial. ✓
- Equals zero iff all slots have identical utilisation per dimension. Non-trivial. ✓
- Minimising it pushes toward balanced load. Monotonically meaningful. ✓

---

## My Second Extension: SLA Urgency U(σ)

### Definition

$$U(\sigma) = \sum_{i=1}^{n} w(t_i) \cdot \frac{\sigma(t_i) - l_i}{u_i - l_i + 1}$$

This measures how far into its SLA window each task was scheduled, scaled by its priority weight. 0 means the task ran at the earliest valid slot; 1 means it ran at the latest.

### Why I chose this

Consider two assignments with identical P_base scores: one puts a Tier-1 PSU bank's bureau pull (T2, weight=4) at slot 1 out of its window [0,3], the other puts it at slot 3. The delay cost is the same, but the second assignment is riskier — the task has no buffer. If slot 3 has any issue (Kafka lag, network jitter), the bank's SLA breaches.

U(σ) catches this. High-weight tasks near their deadline contribute heavily. The scheduler is pushed to run important tasks early in their windows when possible, which maximises operational buffer for retries.

It's a softer constraint than P_base — it's more of a risk metric than a hard delay cost. That's why λ₂ = 0.05 is smaller than λ₁ = 0.1. It should influence tie-breaking, not dominate the schedule.

### Properties

- O(n) to compute. Polynomial. ✓  
- Non-trivial: strictly distinguishes slots within the same window. ✓  
- Meaningful: smaller U → tasks run earlier in their windows → more buffer for retries. ✓

---

## Full Penalty

$$\boxed{P(\sigma) = \underbrace{\sum_i w_i(\sigma_i+1)}_{\text{weighted delay}} + 0.1 \cdot \underbrace{L(\sigma)}_{\text{load balance}} + 0.05 \cdot \underbrace{U(\sigma)}_{\text{SLA buffer}}}$$

The λ weights keep P_base dominant. L and U adjust the scheduler's preferences within similar-delay solutions rather than overriding the delay objective entirely. Both can be tuned per deployment — a cluster with expensive GPU hardware might raise λ₁; a deployment serving high-SLA banks might raise λ₂.

**Computability:** O(n·d + K·d) total, as shown above. Polynomial. ✓
