# Liminal — AI Spend Governance for Founder/Operators

> **What:** a Claude Code plugin + governance cockpit that turns AI credits into accountable,
> evidence-backed decisions. **Who:** founder/operators handed expensive AI budgets before they have a
> system to govern them. **Why:** prove spend advances company goals, route work to the right agent,
> and ratify model-usage policy — **without surveilling the team**.
>
> Built at the Claude Build Day (2026-06-13) on **Opus 4.8** (`claude-opus-4-8`), using Claude Code
> **dynamic workflows** — and **built + verified by parallel autonomous Opus 4.8 agents**.

## For judges — verify in 5 commands
Every command was run on this repo; the stated result is what we observed (Node 20+). Full story +
reproduction notes in **[`ORCHESTRATION.md`](ORCHESTRATION.md)**; demo runbook in **[`DEMO.md`](DEMO.md)**.

```bash
cd provenance && npm install && npm run build && npm test   # 18 pass — hash-linked chain + tamper test
cd ../engine  && npm install && npm test                    # 16 pass — incl. LIVE Opus cap refusal
cd .. && node .claude/workflows/spend-audit.mjs              # the audit: naive $446 → verified $284 (E14 dropped)
npm test                                                     # 12 pass — the 5-criterion rubric gate
cd app && npm install && npm run build                       # clean Vite build → app/dist
```
The `engine` LIVE test self-skips without `ANTHROPIC_API_KEY`; everything else runs offline.

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
- `engine/` — AI Spend Governance engine: `analyze` (deterministic findings) · `anchorFindings` (to the
  chain) · `enforceCap` (a **live bounded Opus agent** that refuses over-cap / surveillance decisions).
- `rubric.md` — model-gradable "done" criteria. `tests/` — the verification suite. `BRIEF.md` — the brief.
- `coordination/contract.ts` — the shared wire types every stream mirrors (with a drift guard).
- `ORCHESTRATION.md` — how Opus 4.8 was directed + how it verifies itself. `DEMO.md` — the demo runbook.
- `CONTRIBUTIONS.md` — **what was built today vs. prior art** (read this — DQ-relevant).

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
The cockpit ships as a static SPA to **Vercel** (lane G). From the repo root:

```bash
./deploy.sh              # verify a clean production build, then deploy app/ to PRODUCTION
./deploy.sh --preview    # deploy a non-prod preview URL instead
./deploy.sh --build-only # just verify the production build, no deploy
```

`deploy.sh` runs `cd app && npm install && npm run build`, then
`npx vercel deploy --prod app/`. Vercel reads `app/vercel.json` for the build
settings: `buildCommand` (`npm run build`), `outputDirectory` (`dist`), and the
SPA `rewrites` that route every path back to `index.html` for client-side routing.

First run prompts you to log in / link the Vercel project. For non-interactive
(CI) use, export a token first — `export VERCEL_TOKEN=...` — and `deploy.sh`
passes it through automatically. No secrets are stored in the repo.

## How it was built (orchestration)
The product is built and verified by a **dynamic Claude Code workflow** (`.claude/workflows/`) running
on Opus 4.8: bounded specialist agents deliberate, an adversarial reviewer refutes weak claims, and the
workflow gates "done" against `rubric.md` + `tests/` — no human in the verification loop. The repo
itself was assembled by **parallel autonomous Opus 4.8 agents**, one per stream, kept wire-compatible by
a contract drift guard. Full walkthrough — including the moment the model **caught and dropped its own
weak claim** (the E14 trap) — is in **[`ORCHESTRATION.md`](ORCHESTRATION.md)**; the demo beats are in
**[`DEMO.md`](DEMO.md)**; the done criteria are in `rubric.md`.

## Status
Build-day build (2026-06-13). All five verification commands above are green on this branch.

## License
MIT — see `LICENSE`.
