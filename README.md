# MSME Pipeline Scheduler

ScoreMe MSME Credit Pipeline Scheduling implementation using the PWDR algorithm.

## Requirements

- **Node.js 18+**

## Setup & Run

```bash
npm install
```

## Commands

| Command | What it does |
|---------|------------|
| `npm start` | Run the scheduler (`run.js`) |
| `npm test` | Run tests from `tests/test.js` |
| `npm run benchmark` | Run performance benchmark (saves to `benchmark_results.json`) |

## Quick Start

1. Install dependencies: `npm install`
2. Test it works: `npm test`
3. Run scheduler: `npm start`
4. Check performance: `npm run benchmark`

## Code Location

- **src/scheduler.js** — Main algorithm
- **src/penalty.js** — Penalty calculations
- **src/verify.js** — Solution verification
- **src/generator.js** — Test data generator
- **tests/test.js** — Test suite
