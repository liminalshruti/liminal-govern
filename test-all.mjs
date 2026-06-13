#!/usr/bin/env node
// test-all.mjs — the unified "one green run" for liminal-govern.
//
// Runs every governance sub-suite in a single command, so "done" is one green run
// and another team can re-verify the whole submission tomorrow (the Orchestration ask).
// This is a pure orchestrator: it shells into each package's own `test` script and
// does NOT touch the sub-suites themselves.
//
// Suites (in order):
//   root        tests/*.test.js            — zero-dep (node:test). The 5 rubric.md checks.
//   plugin      plugin/test/*.test.js      — zero-dep (node:sqlite). Bounded-agent + correction loop.
//   provenance  provenance/tests/*.test.ts — needs `npm install` + `npm run build` first; this
//                                            runner installs+builds on first run, then reuses.
//
// Note: `engine/` ships its own suite (`npm --prefix engine test`) but is intentionally
// NOT in this gate yet — see README "How 'done' is verified". The integration owner can
// fold it in by adding it to SUITES below.
//
// Any suite failure fails the whole run (exit 1). Run from the repo root: `npm test`.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function sh(label, cmd, args, cwd = root) {
  process.stdout.write(`\n─── ${label} ───\n$ ${cmd} ${args.join(' ')}  (cwd: ${cwd === root ? '.' : 'provenance'})\n`);
  return spawnSync(cmd, args, { stdio: 'inherit', cwd }).status === 0;
}

const results = [];

// 1) root suite — zero dependencies (node:test + built-ins).
results.push(['root        (tests/)', sh('root suite', npm, ['run', 'test:root'])]);

// 2) plugin suite — zero dependencies (node:sqlite).
results.push(['plugin      (plugin/test/)', sh('plugin suite', npm, ['run', 'test:plugin'])]);

// 3) provenance suite — TypeScript package; install + build on first run, then test.
const provDir = join(root, 'provenance');
let provOk = true;
if (!existsSync(join(provDir, 'node_modules'))) {
  // `npm ci` is reproducible (lockfile-pinned); fall back to `install` if ci can't run.
  provOk = sh('provenance install (npm ci)', npm, ['ci'], provDir)
        || sh('provenance install (npm install)', npm, ['install'], provDir);
}
if (provOk && !existsSync(join(provDir, 'dist', 'index.js'))) {
  provOk = sh('provenance build', npm, ['run', 'build'], provDir);
}
if (provOk) {
  provOk = sh('provenance suite', npm, ['test'], provDir);
} else {
  process.stdout.write('\n[provenance] skipped tests — install/build failed (network needed once for deps).\n');
}
results.push(['provenance  (provenance/tests/)', provOk]);

// summary
process.stdout.write('\n═══ unified test summary ═══\n');
let failed = 0;
for (const [name, ok] of results) {
  process.stdout.write(`  ${ok ? '✓ PASS' : '✗ FAIL'}  ${name}\n`);
  if (!ok) failed += 1;
}
process.stdout.write(
  failed
    ? `\n${failed} of ${results.length} suite(s) failed.\n`
    : `\nAll ${results.length} suites green.\n`,
);
process.exit(failed ? 1 : 0);
