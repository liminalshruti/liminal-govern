# Liminal — AI Spend Governance for Founder/Operators

[![CI](https://github.com/liminalshruti/liminal-govern/actions/workflows/ci.yml/badge.svg)](https://github.com/liminalshruti/liminal-govern/actions/workflows/ci.yml)

> **Govern AI spend. Upgrade agent selection. Ratify decisions. Prove ROI.**
>
> Liminal is a **Claude Code plugin + desktop governance layer** for founders/operators who need to
> control AI spend, evaluate agent performance, and ratify model-usage decisions **without surveilling
> their teams.** It turns AI credits into an accountable operating system.
>
> Built at the Claude Build Day (2026-06-13) on **Opus 4.8**, using Claude Code **dynamic workflows**.

**Live demo:** **https://liminal-govern-cockpit.vercel.app** — the cockpit, live. Auto-deploys from `main` (Vercel root directory `app/`).

## The problem
You run an AI-native team. Your CEO just handed a few engineers a frontier model and a real credit
budget, and wants ROI. Right now — can you prove that budget isn't being burned on calendar scheduling?
Can you govern it **without spying on your people?** Founders/operators are deploying agents faster than
they can govern them: they can't prove usage advances company goals, can't explain which models/agents
are worth the cost, and can't govern usage without becoming a surveillance layer.

## Who it's for
The **AI-transformation / engineering leader with budget authority over advanced-model access** (persona:
**Maria**) at a 200–5,000-person company piloting AI agents. The accountability lands on the **agents'
work and the spend** — never on employees.

## What it does — a governance *workflow*, not a dashboard
The app shows a Tray, a Slate, a decision trail, and a report — but **the product is the workflow**, not
the charts. (A dashboard-as-the-main-feature is explicitly *not* what this is; the magic is the chained
governance gate.)

`liminal setup` → map AI usage to **OKRs** → pull diffuse context into a hardened working set →
**bounded agents deliberate** over spend/usage/agent-fit/risk → an adversarial reviewer **refutes weak
claims** → surface a quantified finding → recommend a **better verified internal agent** (trustless
registry) → **ratify a decision** into a **provenance trail** team agents reference going forward →
generate an exec-ready **AI Spend Brief**.

**The one decision that proves the product:** *"Opus 4.8 cannot be used for calendar management — use
the verified CalendarOps Agent instead."* That single ratified policy demonstrates spend governance +
agent routing + the trustless agent registry + provenance + non-surveillance, all at once.

## Architecture
| Layer | What it does | Where |
|---|---|---|
| **Claude Code plugin** | installs Liminal, runs setup, connects existing context/MCPs | `plugin/` |
| **Desktop / web cockpit** | operator surfaces: Tray, Slate, decisions, reports | `app/` |
| **Governance engine** | deterministic spend analysis + bounded Opus cap-enforcement | `engine/` |
| **Provenance chain** | hash-linked, append-only decision/policy trail + receipts | `provenance/` |
| **Deliberation workflow** | bounded agents analyze spend/usage/agent-fit/risk/ROI, then self-verify | `.claude/workflows/` |
| **Trustless agent registry** | recommends better/verified internal agents | `app/` (reused) |
| **Fixture** | seeded AI-usage governance dataset for the demo | `data/` |

## Repo map
- `plugin/` — the Claude Code plugin (front door + `liminal setup` + onboarding swarm). **Stream S2.**
- `provenance/` — clean local-first provenance chain (hash-linked log, anchor receipts, corrections,
  decision/policy packets). **Stream S1.**
- `engine/` — the AI Spend Governance engine: deterministic seat-utilization analysis, provenance-anchored
  savings findings, and a bounded Opus agent that enforces a spend cap (judges decisions, not people).
- `app/` — the public desktop/web governance cockpit slice + the reused trustless-agents UI. **S3/S5.**
- `.claude/workflows/` — the saved dynamic workflow + its deterministic core. **Stream S4.**
- `data/` — the seeded AI-usage governance fixture.
- `coordination/contract.ts` — the shared wire types (the contract the `provenance/` mirror is drift-guarded against).
- `BRIEF.md` — the `/spend-audit` problem brief judges read alongside `rubric.md`.
- `rubric.md` — model-gradable "done" criteria. `tests/` — the root verification suite.
- `CONTRIBUTIONS.md` — **what was built today vs. prior art** (read this — DQ-relevant).
- `SUBMISSION_CHECKLIST.md` — the 5pm pre-submit gate.

## Run the /spend-audit demo
The orchestration artifact is a dynamic Claude Code workflow with a deterministic core. It classifies
every Opus-4.8 usage event against the OKR baseline, detects misalignment, runs an **adversarial
cross-check that drops weak claims** (the E14 calendar-sync trap → refuted by PR-103, naïve $446 →
verified $284), and anchors the surviving findings + the ratified decision into the provenance chain.

```bash
# 1. Build the provenance chain the workflow anchors into (one-time; needs network for deps):
npm --prefix provenance install && npm --prefix provenance run build

# 2. Run the audit on the seeded fixture → regenerates out/report.json (deterministically):
node .claude/workflows/spend-audit.mjs data/usage-events.csv

# 3. Re-run on a fresh dataset in one command (rerunnability — the Orchestration ask):
node .claude/workflows/spend-audit.mjs data/q3/usage-events.csv out/report-q3.json
```

See `BRIEF.md` for the full problem framing and `.claude/workflows/README.md` for the workflow phases.

## How "done" is verified (no human in the loop)
"Done" is gated against `rubric.md` + the test suites — the model grades itself, and the workflow only
emits success when all five rubric checks hold. **One green run verifies the whole submission:**

```bash
npm test          # unified gate → test-all.mjs runs every governance sub-suite in one command
```

`npm test` (root) runs **`test-all.mjs`**, which shells into each package's own suite:

| Suite | Command it runs | What it proves | Count |
|---|---|---|---|
| **root** | `npm run test:root` (`node --test tests/*.test.js`) | the 5 `rubric.md` checks: OKR baseline · classification coverage · misalignment detected · ratified decision anchored · report reconciles to $284 ±$1 | 12 |
| **plugin** | `npm run test:plugin` | plugin manifest + consent gate, bounded-agent refusal, `/try-liminal` deliberation, correction round-trip, and the onboarding swarm (the cold-start "beats an empty setup" beat) | 14 |
| **provenance** | `npm run test:provenance` | hash determinism + golden vector, chain integrity + byte-flip tamper detection, INSERT-only immutability, reconcile ±$1, local-first no-network anchoring, contract drift-guard | 22 |
| **engine** | `npm run test:engine` | deterministic seat-utilization `analyze` + reconcile, provenance-`anchor` of findings, and the bounded `enforceCap` agent's cap/out-of-lane refusals | 16 |
| **app** | `node --test app/tests/coherence.test.mjs` (run by `test-all.mjs`) | the cockpit's demo-coherence gate: its displayed numbers reconcile to `report.json` ($284 verified · E14 dropped) so the live cockpit can't drift from the pitch | 5 |

All green = **69 checks across 5 suites** (one `engine` live-Opus assertion auto-skips without
`ANTHROPIC_API_KEY`, so CI runs **68 pass + 1 skip**). The `provenance/` and `engine/` suites need their
deps installed (and `provenance/` built) first; `test-all.mjs` does that on first run (one-time network)
and runs `engine` **after** `provenance` because it imports the built provenance dist — then reuses
`node_modules` + `dist`.
The deterministic core regenerates `out/report.json` byte-identically on a re-run, so another team can
re-verify "done" tomorrow on a fresh dataset in one command.

### CI
`.github/workflows/ci.yml` runs the unified `npm test` on every push and pull request (Node 22), so the
verification loop is rerunnable by anyone — the badge above reflects live status.

## Run the cockpit locally
The operator cockpit (`app/`) is a Vite + React + TypeScript web app — no native toolchain required.

```bash
cd app
npm install
npm run dev        # → http://localhost:5173  (hot-reloading dev server)
```

Other useful scripts (all run from `app/`):

```bash
npm run build      # tsc -b && vite build  →  static bundle in app/dist/
npm run preview    # serve the production build locally
npm run typecheck  # tsc --noEmit (type-check only)
```

See `app/README.md` for the screen map and the provenance data-seam.

## Deploy to a live URL (one command)
The cockpit ships as a static SPA to **Vercel**. From the repo root:

```bash
./deploy.sh              # verify a clean production build, then deploy app/ to PRODUCTION
./deploy.sh --preview    # deploy a non-prod preview URL instead
./deploy.sh --build-only # just verify the production build, no deploy
```

`deploy.sh` runs `cd app && npm install && npm run build`, then `npx vercel deploy --prod app/`. Vercel
reads `app/vercel.json` for the build settings: `buildCommand` (`npm run build`), `outputDirectory`
(`dist`), and the SPA `rewrites` that route every path back to `index.html` for client-side routing.

First run prompts you to log in / link the Vercel project. For non-interactive (CI) use, export a token
first — `export VERCEL_TOKEN=...` — and `deploy.sh` passes it through automatically. No secrets are
stored in the repo. **The live URL is already pinned at the top of this README** and auto-deploys from
`main` (Vercel root directory `app/`), so a merge to `main` redeploys the cockpit.

## How it was built (orchestration)
The product is built and verified by a **dynamic Claude Code workflow** (`.claude/workflows/`) running
on Opus 4.8: bounded specialist agents deliberate, an adversarial reviewer refutes weak claims, and the
workflow gates "done" against `rubric.md` + the test suites — no human in the verification loop.

## Status
Build-day build. Submission readiness is tracked in `SUBMISSION_CHECKLIST.md`; per-stream contributions
(built-today vs. prior art) are in `CONTRIBUTIONS.md`.

## License
MIT — see `LICENSE`.
