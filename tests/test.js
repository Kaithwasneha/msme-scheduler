'use strict';
const { schedule }       = require('../src/scheduler');
const { bruteForce }     = require('../src/brute-force');
const { verify }         = require('../src/verify');
const { computePenalty } = require('../src/penalty');

let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

// ── T1: All-conflict graph (chromatic number > K) ────────────────────────────
console.log('\n[T1] Complete graph K₄ with K=2 slots → infeasible (χ(K₄)=4 > 2)');
{
  const inst = {
    tasks: ['T0','T1','T2','T3'],
    conflicts: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],
    resources: [[1,1,0,0],[1,1,0,0],[1,1,0,0],[1,1,0,0]],
    capacities: [[32,128,8,6],[32,128,8,6]],
    windows: [[0,1],[0,1],[0,1],[0,1]],
    weights: [1,1,1,1], K: 2
  };
  const r = schedule(inst);
  assert(!r.feasible, 'K₄ with K=2 correctly reported infeasible');
  assert(typeof r.violation_reason === 'string' && r.violation_reason.length > 0,
    'violation_reason is a non-empty string');
  assert(r.assignment === null, 'assignment is null when infeasible');
}

// ── T2: Zero-capacity slot ────────────────────────────────────────────────────
console.log('\n[T2] Zero-capacity slot 0 — tasks must land in slot 1');
{
  const inst = {
    tasks: ['T0','T1'],
    conflicts: [],
    resources: [[2,2,0,0],[2,2,0,0]],
    capacities: [[0,0,0,0],[32,128,8,6]],
    windows: [[0,1],[0,1]],
    weights: [1,1], K: 2
  };
  const r = schedule(inst);
  assert(r.feasible, 'Feasible when slot 1 has enough capacity');
  if (r.feasible) {
    assert(r.assignment['T0'] === 1, 'T0 lands in slot 1 (slot 0 zero-cap)');
    assert(r.assignment['T1'] === 1, 'T1 lands in slot 1');
    const aArr = ['T0','T1'].map(t => r.assignment[t]);
    const v = verify(aArr, inst.conflicts, inst.resources, inst.capacities, inst.windows, inst.K);
    assert(v.valid, 'Zero-cap assignment satisfies all three constraints (F1/F2/F3)');
  }
}

// ── T3: Tight SLA — non-conflicting, each task has window of size 1 ──────────
console.log('\n[T3] Tight SLA: each task pinned to exactly one slot, no conflicts');
{
  const inst = {
    tasks: ['T0','T1','T2'],
    conflicts: [[0,1]],
    resources: [[1,1,0,0],[1,1,0,0],[1,1,0,0]],
    capacities: [[32,128,8,6],[32,128,8,6],[32,128,8,6]],
    windows: [[0,0],[1,1],[2,2]],
    weights: [1,1,1], K: 3
  };
  const r = schedule(inst);
  assert(r.feasible, 'Non-conflicting tight SLA is feasible');
  if (r.feasible) {
    assert(r.assignment['T0'] === 0, 'T0 in slot 0 (only option)');
    assert(r.assignment['T1'] === 1, 'T1 in slot 1 (only option)');
    assert(r.assignment['T2'] === 2, 'T2 in slot 2 (only option)');
  }
}

// ── T3b: Tight SLA + conflict → infeasible ───────────────────────────────────
console.log('\n[T3b] Tight SLA: conflicting tasks both forced to slot 0 → infeasible');
{
  const inst = {
    tasks: ['T0','T1'],
    conflicts: [[0,1]],
    resources: [[1,1,0,0],[1,1,0,0]],
    capacities: [[32,128,8,6],[32,128,8,6]],
    windows: [[0,0],[0,0]],
    weights: [1,1], K: 2
  };
  const r = schedule(inst);
  assert(!r.feasible, 'Conflicting tasks with identical tight window [0,0] → infeasible');
}

// ── T4: Single-task instance ─────────────────────────────────────────────────
console.log('\n[T4] Single task — always feasible');
{
  const inst = {
    tasks: ['T0'],
    conflicts: [],
    resources: [[4,16,1,0.5]],
    capacities: [[32,128,8,6],[32,128,8,6],[32,128,8,6]],
    windows: [[0,2]],
    weights: [5], K: 3
  };
  const r = schedule(inst);
  assert(r.feasible, 'Single task is feasible');
  assert(r.assignment !== null, 'Assignment object returned');
  if (r.feasible) {
    const s = r.assignment['T0'];
    assert(s >= 0 && s <= 2, `Slot ${s} within SLA window [0,2]`);
    assert(typeof r.penalty === 'number' && r.penalty > 0, 'Penalty is a positive number');
    assert(typeof r.runtime_ms === 'number', 'runtime_ms is a number');
  }
}

// ── T5: Assignment toy instance (spec §3.3) ───────────────────────────────────
console.log('\n[T5] Assignment spec toy instance: 6 tasks, verify against brute force');
{
  const inst = {
    tasks: ['T1','T2','T3','T4','T5','T6'],
    conflicts: [[0,1],[0,2],[1,3],[2,4],[3,5],[4,5]],
    resources: [[8,32,4,1.5],[4,16,0,3.0],[2,8,0,2.0],[16,64,2,0.5],[8,32,2,1.0],[4,16,0,1.5]],
    capacities: [[32,128,8,6],[32,128,8,6],[32,128,8,6],[32,128,8,6]],
    windows: [[0,2],[0,3],[0,3],[1,3],[0,3],[1,3]],
    weights: [5,4,3,2,3,2], K: 4
  };
  const r   = schedule(inst);
  const opt = bruteForce(inst);

  assert(r.feasible, 'Toy instance is feasible');
  assert(opt.feasible, 'Brute-force finds a valid assignment too');

  if (r.feasible) {
    const aArr = inst.tasks.map(t => r.assignment[t]);
    const v = verify(aArr, inst.conflicts, inst.resources, inst.capacities, inst.windows, inst.K);
    assert(v.valid, `PWDR assignment satisfies F1/F2/F3 (verify: ${v.reason ?? 'OK'})`);
    assert(r.penalty > 0, 'PWDR penalty is positive');
  }

  if (r.feasible && opt.feasible) {
    const ratio = r.penalty / opt.penalty;
    assert(ratio <= 2.0,
      `PWDR ratio ${ratio.toFixed(3)} ≤ 2.0× OPT (PWDR=${r.penalty.toFixed(2)}, OPT=${opt.penalty.toFixed(2)})`);
  }
}

// ── T6: computePenalty properties ────────────────────────────────────────────
console.log('\n[T6] computePenalty: deterministic and consistent with slot indices');
{
  const assignment = [0, 1, 2];
  const weights = [1, 1, 1];
  const windows = [[0,2],[0,2],[0,2]];
  const resources = [[1,1,0,0],[1,1,0,0],[1,1,0,0]];
  const capacities = [[32,128,8,6],[32,128,8,6],[32,128,8,6]];
  const p1 = computePenalty(assignment, weights, windows, resources, capacities, 3);
  const p2 = computePenalty(assignment, weights, windows, resources, capacities, 3);
  assert(p1 === p2, 'computePenalty is deterministic');
  assert(p1 > 0, 'Penalty is positive for non-zero assignments');

  // Later slot = higher base penalty
  const pEarly = computePenalty([0,0,0], weights, windows, resources, capacities, 3);
  const pLate  = computePenalty([2,2,2], weights, windows, resources, capacities, 3);
  assert(pEarly < pLate, 'Earlier slot assignment → lower penalty than later slots');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Some tests failed.');
  process.exit(1);
}
