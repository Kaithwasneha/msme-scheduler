'use strict';
const fs = require('fs');
const { generateInstance } = require('./src/generator');
const { schedule } = require('./src/scheduler');

function parseArgs(argv) {
  const opts = { n: 20, K: 5, density: 0.3, seed: 42, input: null, output: null };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--n':       opts.n       = parseInt(argv[++i], 10); break;
      case '--K':       opts.K       = parseInt(argv[++i], 10); break;
      case '--density': opts.density = parseFloat(argv[++i]);   break;
      case '--seed':    opts.seed    = parseInt(argv[++i], 10); break;
      case '--input':   opts.input   = argv[++i];               break;
      case '--output':  opts.output  = argv[++i];               break;
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

const instance = opts.input
  ? JSON.parse(fs.readFileSync(opts.input, 'utf8'))
  : generateInstance(opts.n, opts.K, 4, opts.density, opts.seed);

const result = schedule(instance);

const out = JSON.stringify({
  assignment:       result.assignment,
  penalty:          result.penalty,
  runtime_ms:       result.runtime_ms,
  feasible:         result.feasible,
  violation_reason: result.violation_reason
}, null, 2);

if (opts.output) {
  fs.writeFileSync(opts.output, out);
  process.stderr.write(`Result written to ${opts.output}\n`);
} else {
  process.stdout.write(out + '\n');
}
