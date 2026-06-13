# Rubric — model-gradable "done" criteria

> The workflow gates "done" against this file + `tests/`, with no human in the verification loop.
> Each criterion maps to an automated check in `tests/`. (Orchestration score: a rubric the model
> grades against + a rerunnable workflow.)

## Done criteria
1. **OKR baseline exists** — a valid AI Spend Governance Baseline (objectives + KRs + allocations +
   approved model + tracking streams) is produced from setup. `tests/` validates the schema.
2. **Usage classified against OKRs** — every usage event in the fixture is classified to an objective
   (or flagged unclassifiable) with a cited source row. No silent drops.
3. **Misalignment detected** — the workflow detects the misaligned Opus 4.8 usage (calendar/admin) and
   the under-allocation vs the 40% target, and surfaces the cheaper verified-agent recommendation.
4. **Decision ratified to the provenance trail** — a ratified decision (with rationale, referenced
   context, `agent_policy`, and the approved alternative agent) is appended to the provenance chain;
   the chain verifies (hash-linked, immutable) and the decision is re-readable.
5. **Report cites its sources** — the AI Spend Brief cites the ratified decision + the source context
   rows; the savings/ROI figures reconcile to the underlying usage data (±$1).

## How to run the checks
```
npm test          # runs tests/ — schema validation, classification coverage, chain integrity, reconciliation
```
"Done" = all five pass. The dynamic workflow re-runs this gate and only emits success when it holds.

## Rerunnability
The workflow accepts the fixture path as input — re-run on a new dataset in one command to prove the
orchestration is repeatable on a fresh problem.
