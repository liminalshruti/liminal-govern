# Brief — /spend-audit (S4 Orchestration)

> The problem, who it's for, and what "done" means — the brief the judges read alongside `rubric.md`
> and the saved workflow. Pairs with `.claude/workflows/spend-audit.js` (the orchestration artifact)
> and `tests/` (the model-graded gate).

## Problem
A founder/operator gives a cohort of engineers early access to **Claude Opus 4.8** with a real credit
budget and a mandate: **60% product development / 40% security hardening**. Mid-period they cannot
answer the board question — *is the spend advancing the goals, or being burned on work a cheaper agent
should do?* — and they must answer it **without surveilling their people**.

## Who it's for
The AI-transformation / engineering leader with budget authority over advanced-model access (persona:
**Maria**). The accountability is on the **agents' work and the spend**, never on employees.

## What it does
`/spend-audit on data/usage-events.csv` runs a dynamic workflow that:
1. **Ingests** the usage fixture + the OKR baseline + the agent registry + PR / security evidence.
2. **Classifies** every Opus-4.8 usage event against the OKRs (or flags it unclassified) — no silent drops.
3. **Deliberates** with **8 bounded, `model: opus` agents** (Spend analyst · OKR-alignment ·
   Productivity-evidence · Security-evidence · Misuse/policy · Agent-marketplace evaluator · Provenance ·
   Exec-comms), each refusing out-of-lane.
4. **Adversarially reviews** every savings claim with a fresh Read-only reviewer that **refutes** weak
   ones. The hero beat: a naïve misuse pass flags **E14** ("calendar-sync") as $162 of routable calendar
   waste — but **PR-103 proves E14 is product engineering**, so the reviewer **drops the claim**. Naïve
   $446 → **verified $284**. The model caught its own error.
5. **Anchors** each surviving finding + the **ratified decision** ("Opus 4.8 cannot be used for calendar
   management — use the verified CalendarOps Agent") into the local-first **provenance chain**
   (`provenance/`); the chain verifies (hash-linked, immutable).
6. **Verifies** itself against `rubric.md` + `tests/` and only reports success when all five checks pass.

## What "done" means (model-verifiable — no human in the loop)
`npm test` is green (**12 pass, 0 fail, 0 skip**) — the five `rubric.md` checks, enforced in `tests/`:
1. OKR baseline exists. 2. Every usage event classified to an OKR. 3. Misalignment detected (security
**24% vs 40%** target). 4. A ratified decision (with `agent_policy` + approved alternative) anchored to
the provenance trail. 5. The report cites its sources and the savings **reconcile to $284 ±$1 with the
E14 trap excluded** — counting the dropped claim breaks the gate (fails closed).

## Rerunnability
`node .claude/workflows/spend-audit.mjs <fixture>` (and the saved `/spend-audit on <fixture>` workflow)
accept the fixture path as input; the deterministic core regenerates `out/report.json` **byte-identically**
on a re-run (same hashes), so another team can rerun the setup tomorrow on a new dataset in one command.

## Model
Built with **Claude Opus 4.8** (`claude-opus-4-8`) via Claude Code dynamic workflows; the deliberation
and adversarial-review agents run `model: opus`. The deterministic core (`spend-audit.mjs`) makes the
gate reliable; the workflow (`spend-audit.js`) is the orchestration the judges grade.
