# Task 7: Design Journal

*Written by Neha — personal reflection on implementing PWDR*

---

## 1. Hardest Design Decision

The hardest decision was choosing the coefficient for the urgency term in my task-ordering score function. My first version was:

```
score = 100 × saturation + 10 × urgency + weight
```

I ran the benchmark and almost every instance came back INFEASIBLE. I spent probably an hour thinking I'd broken the resource repacking logic, tracing through the algorithm step by step on paper with the small-2 instance (n=10, K=4). The assignment logic looked correct. The conflict checks were correct. I couldn't figure out what was wrong.

Then I added a debug line that printed which task was being selected first in each round, and I saw it — task T7 with weight=8.4 and window=[0,3] (urgency=0.25) was scoring higher than task T3 with weight=0.9 and window=[2,2] (urgency=1.0). T7 would grab slot 2, and then T3 had literally nowhere to go because slot 2 was its only valid slot and a neighbor was now in it.

The trade-off was: if I make urgency coefficient too large, it completely ignores the lender priority weights (which are supposed to matter for ScoreMe's SLA tiers). If too small, tight-window tasks get preempted and PWDR paints itself into corners.

I tried 50 first (too much — weight becomes meaningless), then landed on 100 for urgency, keeping 100 for saturation. With generator weights capped at 10, urgency for a size-1 window scores 100 versus a maximum weight contribution of 10. So tight windows always go first in early rounds. Weight still matters when two tasks have the same urgency. That felt like the right balance to me.

The alternative I seriously considered was a two-phase approach: first assign all window-size-1 tasks in priority order, then run DSATUR on the rest. I rejected it because it breaks the elegant DSATUR property that saturation-based ordering achieves — you'd lose the adaptive conflict-awareness for the second phase.

---

## 2. Empirical Failure

My algorithm failed on every instance from medium-1 (n=50) upwards. When I first saw this I was genuinely confused — stress-3 has K=20 slots and only density=0.1, it looked like it should be easy.

I spent time on stress-3 specifically. I added print statements to show me which task was failing and why. The output said things like: "Task T143: all SLA slots [16,17] blocked by conflicts." So T143 has a window of size 2, and both slots 16 and 17 are occupied by conflicting neighbors. That's a genuine coloring impossibility — not a PWDR ordering failure, but an actual infeasibility in the instance.

Then I went back and did the math. For K=20, the generator picks lo from Uniform[0, 18] and hi from Uniform[lo+1, 19]. The average window size works out to about 5.5 slots. But with n=200 tasks and density=0.1, average degree is about 20 neighbors per task. Each task needs a slot from its list of ~5.5, but has 20 neighbors with competing lists. That's essentially the list-coloring problem, and it's much harder than regular graph coloring.

The brute force on small-3 (n=12, K=4, density=0.5) confirmed it: OPT=INFEASIBLE. So the instances really are infeasible, not just hard for my greedy approach.

With more time, I would write a constraint-propagation feasibility checker that runs before PWDR — something that detects when a subset of tasks form an infeasible subproblem (e.g., clique of size > available distinct slots across their collective windows). This would let me report infeasibility with a clear explanation of WHY rather than just "no feasible slot found after repacking."

I'd also try a different generator that guarantees feasibility — for instance, start from a valid coloring and then add random perturbations, rather than generating conflicts from scratch.

---

## 3. Production System Link

This exact problem appears in ScoreMe's **OCR GPU cluster** scheduling.

The Bank Statement OCR task (T1-type in our formulation) and the Fraud Score ML inference task (T4-type) both require GPU units. They cannot run simultaneously because they share the GPU memory bus — this is exactly the F1 conflict constraint. The "processing slots" in our model correspond to ScoreMe's 30-second execution windows.

The resource dimensions map directly: T1 needs 4 GPU units and 1.5 Gbps network (for receiving document uploads); T4 needs 2 GPU units and 0.5 Gbps but 16 CPU cores for inference. The slot capacity vector [32 CPU, 128 RAM, 8 GPU, 6 Net] reflects a single GPU node's resources in one 30-second window.

The SLA windows [l_i, u_i] correspond to lender SLA commitments — a Tier-1 PSU bank's bureau pull must complete within the first 4 slots (2 minutes) of a credit evaluation session, while a Tier-3 NBFC's document check might have a 10-slot window.

PWDR would apply here by treating each pipeline stage as a task, conflict pairs as GPU-bus contention relationships, and 30-second windows as slots. The penalty function's load-imbalance term L(σ) directly addresses the GPU hotspot problem — it pushes the scheduler away from stacking all GPU-heavy tasks in one slot, which is exactly the operational concern a platform engineer would have.

---

## 4. Surprise Learning

What genuinely surprised me was how much the **jitter range mattered** for the restarts.

My first restart implementation used jitter = Uniform(−0.4, +0.4). I thought this would diversify the ordering enough to escape bad greedy choices. It didn't. When I ran 20 restarts on small-2, it failed all 20 times. I added logging to print the first few task selections per restart and realized: the orderings were nearly identical. The jitter was too small relative to the urgency scores (which range up to 100), so floating-point differences between tasks were never large enough to flip their ordering.

Once I realised the jitter needs to cover the full dynamic range of the score function, I set it to Uniform(−60, +60) — roughly matching the 100-point urgency scale. Suddenly restart 3 solved small-2 on the first try.

This taught me something about randomised algorithms I hadn't really internalised before: the noise has to be calibrated to the signal. Tiny random perturbations on a strongly-structured objective function are effectively deterministic. You're not actually exploring the search space — you're just adding rounding errors. The jitter needs to be large enough to actually reorder tasks, which means understanding the scale of your scoring components, not just adding "a little randomness" and hoping for the best.

I also didn't expect how rarely backtracking is actually needed in practice. The combination of saturation-based ordering (which DSATUR gives you) plus urgency prioritisation handles the overwhelming majority of instances correctly on the first greedy pass. Restarts were only needed on 1 out of the 3 feasible instances in my benchmark. For an assignment that emphasised "heuristic design," it was reassuring that getting the ordering right mattered far more than any amount of backtracking cleverness.
