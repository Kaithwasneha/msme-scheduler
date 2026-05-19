'use strict';
const fs = require('fs');
const { generateInstance } = require('./src/generator');
const { schedule } = require('./src/scheduler');
const { bruteForce } = require('./src/brute-force');

const BENCHMARKS = [
  { n: 8,   K: 3,  density: 0.3,  seed: 1,  label: 'small-1'      },
  { n: 10,  K: 4,  density: 0.4,  seed: 2,  label: 'small-2'      },
  { n: 12,  K: 4,  density: 0.5,  seed: 3,  label: 'small-3'      },
  { n: 50,  K: 8,  density: 0.25, seed: 10, label: 'medium-1'     },
  { n: 100, K: 10, density: 0.30, seed: 11, label: 'medium-2'     },
  { n: 150, K: 12, density: 0.35, seed: 12, label: 'medium-3'     },
  { n: 200, K: 15, density: 0.40, seed: 20, label: 'stress-1'     },
  { n: 200, K: 5,  density: 0.60, seed: 21, label: 'stress-2(tK)' },
  { n: 200, K: 20, density: 0.10, seed: 22, label: 'stress-3(sp)' },
];

// ── ASCII bar chart helpers ───────────────────────────────────────────────────

function asciiBar(value, maxValue, width = 36) {
  if (maxValue === 0) return '░'.repeat(width);
  const filled = Math.round((value / maxValue) * width);
  return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(0, width - filled));
}

function printChart(title, rows, yLabel) {
  console.log(`\n  ┌─ ${title}`);
  console.log('  │' + '─'.repeat(58));
  const maxY = Math.max(...rows.map(r => r.y), 1);
  for (const r of rows) {
    const bar = asciiBar(r.y, maxY);
    const val = r.y >= 1000 ? r.y.toFixed(0)
              : r.y >= 1    ? r.y.toFixed(1)
              :                r.y.toFixed(4);
    console.log(`  │  ${r.label.padEnd(14)} ${bar} ${val} ${yLabel}`);
  }
  console.log('  └' + '─'.repeat(58));
}

// ── Run benchmarks ────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║       PWDR Benchmark Results — MSME Pipeline Scheduler      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const header = `${'Label'.padEnd(14)} ${'n'.padEnd(4)} ${'K'.padEnd(4)} ${'ρ'.padEnd(5)} ${'OK?'.padEnd(6)} ${'Penalty'.padEnd(12)} ${'ms'.padEnd(6)} ${'Ratio'.padEnd(7)} Notes`;
console.log('\n  ' + header);
console.log('  ' + '─'.repeat(header.length + 2));

const results = [];

for (const bench of BENCHMARKS) {
  const instance = generateInstance(bench.n, bench.K, 4, bench.density, bench.seed);
  const result   = schedule(instance);

  let optPenalty = null, ratio = null, note = '';
  if (bench.n <= 12) {
    const opt = bruteForce(instance);
    if (opt.feasible && result.feasible) {
      optPenalty = opt.penalty;
      ratio      = result.penalty / opt.penalty;
      note       = `OPT=${opt.penalty.toFixed(1)}`;
    } else if (!opt.feasible) {
      note = 'OPT=INFEASIBLE';
    } else if (opt.feasible && !result.feasible) {
      note = `PWDR_FAIL OPT=${opt.penalty.toFixed(1)}`;
    }
  }

  const row = { ...bench, feasible: result.feasible, penalty: result.penalty, runtime_ms: result.runtime_ms, opt_penalty: optPenalty, ratio };
  results.push(row);

  const penStr   = result.feasible ? result.penalty.toFixed(2) : 'INFEASIBLE';
  const ratioStr = ratio !== null ? ratio.toFixed(3) : '—      ';
  const ok       = result.feasible ? 'YES' : 'NO ';

  console.log(`  ${bench.label.padEnd(14)} ${String(bench.n).padEnd(4)} ${String(bench.K).padEnd(4)} ${String(bench.density).padEnd(5)} ${ok.padEnd(6)} ${penStr.padEnd(12)} ${String(result.runtime_ms).padEnd(6)} ${ratioStr.padEnd(7)} ${note}`);
}

// ── ASCII Charts ──────────────────────────────────────────────────────────────

const penaltyRows = results
  .filter(r => r.feasible && r.penalty != null)
  .map(r => ({ label: r.label, y: r.penalty }));

const runtimeRows = results.map(r => ({ label: r.label, y: r.runtime_ms }));

printChart('Penalty P(σ) per instance (lower = better)', penaltyRows, '');
printChart('Runtime (ms) per instance', runtimeRows, 'ms');

// ── Anomaly notes ─────────────────────────────────────────────────────────────

const infeasible = results.filter(r => !r.feasible);
if (infeasible.length > 0) {
  console.log('\n  ⚠  Infeasible instances:');
  for (const r of infeasible) {
    console.log(`     ${r.label}: n=${r.n} K=${r.K} density=${r.density} — increase K or reduce density`);
  }
} else {
  console.log('\n  ✓  All 9 instances solved feasibly.');
}

const highRatio = results.filter(r => r.ratio != null && r.ratio > 1.5);
if (highRatio.length > 0) {
  console.log('\n  ⚠  High approximation ratio (>1.5× OPT):');
  for (const r of highRatio) {
    console.log(`     ${r.label}: ratio=${r.ratio.toFixed(3)} — greedy ordering sub-optimal on this instance`);
  }
}

fs.writeFileSync('benchmark_results.json', JSON.stringify(results, null, 2));
console.log('\n  Results saved → benchmark_results.json\n');
