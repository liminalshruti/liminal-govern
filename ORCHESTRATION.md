# Orchestration — how Claude Opus 4.8 built and verified this repo

> The Orchestration artifact. This repo wasn't hand-written and demoed; it was **built by parallel
> autonomous Claude Opus 4.8 (`claude-opus-4-8`) agents**, each directed by a brief, and gated against
> a **model-gradable rubric + a test suite** with **no human in the verification loop**. Everything
> below is reproducible — the commands a judge runs are listed, and the outputs are what we saw.

## The directive loop (brief → rubric → saved workflow → tests/gate)

Each agent was handed the same four-part contract, then left to run:

1. **Brief** (`BRIEF.md`) — the problem, the persona (Maria, an AI-transformation lead with budget
   authority), and what "done" means in prose. *"Govern AI spend without surveilling people."*
2. **Rubric** (`rubric.md`) — "done" reduced to **5 model-gradable criteria**, each mapped to an
   automated check. The agent doesn't decide it's finished; the rubric does.
3. **Saved workflow** (`.claude/workflows/spend-audit.js`) — the dynamic Claude Code workflow that *is*
   the orchestration: ingest → deliberate (8 bounded `model: opus` agents) → adversarial review →
   emit + anchor → **verify against `rubric.md` + `tests/`**. It accepts the fixture path as an arg,
   so it re-runs on a new dataset in one command. A deterministic core (`spend-audit.mjs`) makes the
   gate byte-reproducible.
4. **Tests/gate** (`tests/`, plus each package's own `npm test`) — the rubric, enforced. The workflow
   emits "success" **only when all checks pass**. Green tests are the agent's stop condition — made
   literal by a **Stop hook** (`done-gate.mjs`); see *The done-gate* below.

The point: **"done" is machine-checkable, so an agent can verify its own work without a human.**

## How an agent verifies itself (the moment it caught its own error)

The hero of the self-verification story is the **E14 calendar-sync trap**, wired into the fixture and
enforced by the gate:

- A naïve misuse pass flags event **E14** ("calendar-sync") as **$162** of routable calendar-admin
  waste. Naïve recommended savings: **$446**.
- The workflow then runs an **adversarial Read-only reviewer** — running with **extended thinking**, so
  its refutation reasons harder before it drops a claim — that cross-checks every savings claim against
  PR evidence. It finds **PR-103** ("calendar-sync feature — Google Calendar API + UI", by Priya): E14
  is *product engineering on the approved track*, not admin waste. The reviewer **refutes and drops**
  the claim. Verified savings: **$284**.
- This is not a story we tell — it's a **test that fails closed**. `tests/reconcile.test.js` asserts
  both *"surviving findings reconcile to $284 ±$1"* **and** *"counting the dropped E14 claim breaks
  reconciliation (the trap must be excluded)."* If an agent ever re-counts the refuted claim, the gate
  goes red. **The model caught its own error, and the test makes sure it stays caught.**

Run it yourself — the workflow prints the catch live:

```
$ node .claude/workflows/spend-audit.mjs
  classified 21 usage events; Opus 4.8 spend $4500
  security 24% vs 40% target → under-allocated
  naive savings $446 → verified $284 (adversarial review dropped 1 claim[s])
    ✗ F-E14: Refuted by adversarial review: PR-103 ... proves E14 is product engineering ...
  provenance chain: VERIFIED (6 entries) → out/report.provenance.db
  → out/report.json
```

## The done-gate — "done" is a Stop hook, not a human

The verification loop is closed in code by a **Stop hook** (`.claude/workflows/done-gate.mjs`, wired in
`.claude/settings.json`). Every time the model tries to end its turn, the hook runs the unified gate
(`npm test` → `test-all.mjs`: root · plugin · provenance · engine · app) and **blocks "done" until all
suites are green** (currently 5), quoting the failing assertion back to the model when they aren't — the
hook reads the suite count from the runner, so it stays correct as suites are added. The only way to stop
is a green gate. It's the same gate the workflow's Verify phase invokes and the same one a judge runs by
hand — one source of truth for "done."

```
$ # red → the hook refuses to let the turn end, and says exactly why:
Done-gate: the unified 5-suite gate (`npm test`) is NOT green — not done.
Failing:
  ✗ FAIL  root        (tests/)
  1 of 5 suite(s) failed.
Fix until `npm test` prints "All 5 suites green." (exit 0), then stop.
```

Because the E14-trap guard lives *inside* that gate (`tests/reconcile.test.js` — "surviving findings
reconcile to $284 ±$1"), the done-gate also fails closed if the refuted $162 claim is ever re-counted:
the model literally cannot declare itself done while its own error is back. **"Done" is machine-checked
by the model, with no human in the loop** — the literal Orchestration ask.

## Built by parallel autonomous agents

The repo is the merge of independent build-day streams, each an Opus 4.8 agent in its own git
worktree/branch, integrated through one shared wire contract (`coordination/contract.ts`):

| Stream / branch | Agent's deliverable | Lands in |
|---|---|---|
| `s1-provenance` | local-first hash-linked provenance chain + corrections | `provenance/` |
| `s2-plugin` | Claude Code plugin front door + `/try-liminal` | `plugin/` |
| `app-cockpit` / `cockpit-integrate` | operator cockpit + live correction loop | `app/` |
| `agent-fit` | trustless agent registry + fit recommendation | `app/` (`/agent-fit`) |
| `engine` | analyze / anchorFindings / **enforceCap** (live Opus refusal) | `engine/` |
| `s4-orchestration` | the dynamic spend-audit workflow + rubric + gate | `.claude/workflows/`, `rubric.md`, `tests/` |
| `deploy` | one-command Vercel deploy of the cockpit | `deploy.sh` |

They share types — not imports — on purpose: `provenance/` mirrors `coordination/contract.ts`
field-for-field and a **drift-guard test** (`provenance/tests/contract.test.ts`) fails if any agent's
copy diverges. Parallel agents stay wire-compatible without a human reconciling diffs.

## Reproduce it — the exact commands a judge runs

Every command below was run on this repo; the stated result is what we observed. Node 20+.

### 1 · Provenance chain — 18 tests
```bash
cd provenance && npm install && npm run build && npm test
#   ↳ tests 18 · pass 18 · fail 0   (hash determinism + golden vector, byte-flip tamper
#     detection, INSERT-only immutability, reconcile ±$1, local-first no-network anchoring,
#     contract drift-guard)
```

### 2 · Engine — 16 tests, incl. a LIVE Opus refusal
```bash
cd engine && npm install && npm run typecheck && npm test
#   ↳ tests 16 · pass 16 · fail 0   (analyze determinism, reconcile ±$1, anchor + verifyChain,
#     tamper detection, enforceCap refusals — over-cap / out-of-lane / surveillance)
#   ↳ "LIVE: bounded Opus agent refuses an over-cap decision" calls claude-opus-4-8 (~2.6s).
#     It self-SKIPS if ANTHROPIC_API_KEY is absent; everything else runs offline.
```
> Engine anchors into the provenance lib's built `dist/`, so run step 1 first (or
> `npm --prefix ../provenance install && npm --prefix ../provenance run build`).

### 3 · The S4 workflow + its model-graded gate — 12 tests
```bash
# from the repo root — run the deterministic core, then the rubric gate:
node .claude/workflows/spend-audit.mjs        # → emits out/report.json (+ verified provenance.db)
npm test                                       # → node --test tests/*.test.js
#   ↳ tests 12 · pass 12 · fail 0   — the 5 rubric checks, incl. "S4 report satisfies the 5
#     rubric checks", "surviving findings reconcile to $284 ±$1", and the E14-trap guard.
```
Rerun on a **fresh dataset** in one command (proves the orchestration is repeatable, not memorized):
```bash
node .claude/workflows/spend-audit.mjs data/q3/usage-events.csv out/q3-report.json
```
The full dynamic workflow (the Opus-graded path the judges score) is
`.claude/workflows/spend-audit.js`, invoked in Claude Code as `/spend-audit on data/usage-events.csv`.

### 4 · Cockpit — clean production build
```bash
cd app && npm install && npm run build
#   ↳ tsc -b && vite build → dist/  (clean build, ~195 kB JS bundle)
```

### 5 · Plugin — offline integration suite (+ validate)
```bash
node --test plugin/test/*.test.js     # → tests 5 · pass 5 · fail 0  (offline, bundled fixture)
claude plugin validate ./plugin --strict
```

## Why this maps to the rubric

- **Orchestration** — a saved, rerunnable workflow that gates "done" against a written rubric + a test
  suite, built by parallel agents kept wire-compatible by a drift guard. Reproducible by the commands
  above.
- **Opus-4.8 use** — `model: opus` for the 8 deliberation agents and the adversarial reviewer; the
  reviewer additionally runs with **extended thinking** so its E14 refutation reasons harder. Extended
  thinking is incompatible with a forced `tool_choice`, so the reviewer call drops its forced
  StructuredOutput schema and parses the verdict instead — the inverse of `engine/enforce.ts`, whose
  forced `record_verdict` call is deliberately **thinking-OFF** for the same reason. Determinism of the
  E14 drop is unaffected: it's owned by the deterministic core (`spend-audit.mjs`) and the gate, not the
  live read. Plus a **live** `claude-opus-4-8` bounded agent in `engine/enforceCap` that refuses
  over-cap and surveillance decisions (verified by a live test).
- **Self-verification** — the E14 trap: the model refutes its own naïve claim, and a test fails closed
  if the refutation is ever undone.

## Honest scope

Provenance is **local-first by default**; the on-chain Algorand path is **env-gated** (`ANCHOR_URL`)
and never blocks the chain. Demand is **discovery, not closed pilots**. Prior art (the private Liminal
provenance/bounded-agent patterns) is **PPA-protected** — lead US Provisional **64/080,639** — and its
source is **not** in this repo; `provenance/` is a clean reimplementation written today. See
`CONTRIBUTIONS.md` for the full built-today vs. prior-art split.
