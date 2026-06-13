# Liminal — AI Spend Governance for Founder/Operators

> **Govern AI spend. Upgrade agent selection. Ratify decisions. Prove ROI.**
>
> Liminal is a **Claude Code plugin + desktop governance layer** for founders/operators who need to
> control AI spend, evaluate agent performance, and ratify model-usage decisions **without surveilling
> their teams.** It turns AI credits into an accountable operating system.
>
> Built at the Claude Build Day (2026-06-13) on **Opus 4.8**, using Claude Code **dynamic workflows**.

## The problem
Founders/operators running AI-native teams are handed expensive AI budgets before they have systems to
govern them. They can't prove usage advances company goals, can't explain which models/agents are worth
the cost, and can't govern usage without becoming a surveillance layer.

## What it does (the workflow — not a dashboard)
`liminal setup` → map AI usage to **OKRs** → pull diffuse context into a hardened working set →
**bounded agents deliberate** over spend/usage/agent-fit/risk → surface a finding → recommend a
**better verified internal agent** (trustless registry) → **ratify a decision** into a **provenance
trail** team agents reference going forward → generate an exec-ready **AI Spend Brief**.

**The one decision that proves the product:** *"Opus 4.8 cannot be used for calendar management — use
the verified CalendarOps Agent instead."* That single ratified policy demonstrates spend governance +
agent routing + the trustless agent registry + provenance + non-surveillance, all at once.

## Architecture
| Layer | What it does | Where |
|---|---|---|
| **Claude Code plugin** | installs Liminal, runs setup, connects existing context/MCPs | `plugin/` |
| **Desktop app** | operator cockpit: Tray, Slate, decisions, reports | `app/` |
| **Provenance chain** | hash-linked, append-only decision/policy trail + receipts | `provenance/` |
| **Deliberation workflow** | 8 bounded agents analyze spend/usage/agent-fit/risk/ROI | `.claude/workflows/` |
| **Trustless agent registry** | recommends better/verified internal agents | `app/` (reused) |
| **Fixture** | seeded AI-usage governance dataset for the demo | `data/` |

## Repo map
- `plugin/` — the Claude Code plugin (front door + `liminal setup` + onboarding swarm). **Stream S2.**
- `provenance/` — clean local-first provenance chain (hash-linked log, anchor receipts, corrections,
  decision/policy packets). **Stream S1.**
- `app/` — the public desktop/web governance cockpit slice + the reused trustless-agents UI. **S3/S5.**
- `.claude/workflows/` — the saved dynamic workflow + this repo's orchestration entry. **Stream S4.**
- `data/` — the seeded AI-usage governance fixture. 
- `rubric.md` — model-gradable "done" criteria. `tests/` — the verification suite.
- `coordination/` — `contract.ts` (shared wire types), `BUILD_CHECKLIST.md`, `INTEGRATION_HANDOFF.md`,
  `DEMO.md`.
- `CONTRIBUTIONS.md` — **what was built today vs. prior art** (read this — DQ-relevant).

## How it was built (orchestration)
The product is built and verified by a **dynamic Claude Code workflow** (`.claude/workflows/`) running
on Opus 4.8: bounded specialist agents deliberate, an adversarial reviewer refutes weak claims, and the
workflow gates "done" against `rubric.md` + `tests/` — no human in the verification loop. See
`coordination/DEMO.md` for the demo runbook and `rubric.md` for the done criteria.

## Status
Build-day build. See `coordination/INTEGRATION_HANDOFF.md` for live per-stream status.

## License
MIT — see `LICENSE`.
