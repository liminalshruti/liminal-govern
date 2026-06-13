#!/usr/bin/env node
// W3 — done-gate: a Stop hook so the workflow verifies ITSELF, with no human in the loop.
//
// On every attempt to end the turn, this runs the unified 4-suite gate (`npm test`, i.e.
// test-all.mjs: root · plugin · provenance · engine). If all four suites are green it lets the
// turn end; if any suite is red it BLOCKS "done" and quotes the failing assertion(s) back to the
// model — so the ONLY way to stop is to make the gate green. This is the literal Orchestration
// ask: "done is verifiable by the model without a human."
//
// It runs the SAME gate the workflow's Verify phase invokes (.claude/workflows/spend-audit.js) and
// the same one a judge runs by hand (`npm test`) — one source of truth for "done." The E14 trap
// guard (tests/reconcile.test.js: surviving findings reconcile to $284 ±$1) lives inside that gate,
// so this hook also fails closed if the refuted claim is ever re-counted.
//
// Stop-hook contract: print {"decision":"block","reason":...} (exit 0) to keep the turn going;
// exit 0 with no decision to allow the stop. `stop_hook_active` in the payload flags that we've
// already blocked once this stop-cycle — we still block while red (a gate must fail closed; the
// model is expected to fix the suite, not be let through), and a human can always interrupt.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Drain the hook payload on stdin (we don't depend on it; reading avoids any blocking).
try { JSON.parse(readFileSync(0, 'utf8') || '{}') } catch { /* no / non-JSON stdin — fine */ }

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = spawnSync(npm, ['test'], { cwd: root, encoding: 'utf8' })
const out = `${run.stdout || ''}\n${run.stderr || ''}`
const green = run.status === 0 && /All \d+ suites green\./.test(out)

if (green) process.exit(0) // gate green → "done" is verified, allow the stop.

// Red: surface the suite-level failures + the first failing assertions to quote back to the model.
const lines = out.split('\n')
const suiteFails = lines.filter((l) => /✗ FAIL|suite\(s\) failed/.test(l))
const assertFails = lines.filter((l) => /not ok |✖|AssertionError|Error:|✗ /.test(l)).slice(0, 12)
const quoted = [...new Set([...suiteFails, ...assertFails])].join('\n').trim()
  || '(`npm test` exited non-zero — see the run output)'

const reason =
  'Done-gate: the unified 4-suite gate (`npm test`) is NOT green — not done.\n\n' +
  `Failing:\n${quoted}\n\n` +
  'Fix until `npm test` prints "All 4 suites green." (exit 0), then stop.'

process.stdout.write(JSON.stringify({ decision: 'block', reason }))
process.exit(0)
