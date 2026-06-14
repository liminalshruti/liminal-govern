# Liminal — AI Spend Governance

[![CI](https://github.com/liminalshruti/liminal-govern/actions/workflows/ci.yml/badge.svg)](https://github.com/liminalshruti/liminal-govern/actions/workflows/ci.yml)

> **AI gives you infinite answers. Liminal gives you a record of which ones you trusted.**
>
> Operator-intelligence infrastructure: bounded agents read your team's AI spend, **the model catches its
> own errors**, and every decision enters a hash-linked provenance chain — **governance without
> surveilling your people.** Built at Claude Build Day (2026-06-13) on **Opus 4.8** + Claude Code dynamic
> workflows.

---

## 👋 Judges — start here
| | |
|---|---|
| ▶ **Live cockpit** | **https://liminal-govern-cockpit.vercel.app** — the product, live (auto-deploys from `main`) |
| 🎬 **1-min demo video** | https://drive.google.com/file/d/14uzy0KED-uJZSkYtRDZZY_n_5wo8OscK/view |
| 📜 **Session log** (the real `/spend-audit` run, the self-catch verbatim) | [`SESSION_LOG.md`](SESSION_LOG.md) |
| ⚡ **Verify in 2 moves** | `npm test` (the 5-suite gate, below) · open the live cockpit → **Findings** → see the model drop its own claim |
| 🧭 **What's built today vs. prior art** | [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) (DQ-relevant — read this) |

### The 30-second story
You run an AI-native team. Your CEO handed a few engineers a frontier model and a real credit budget, and
wants ROI. Right now — can you prove that budget isn't being burned on calendar scheduling? Can you govern
it **without spying on your people?** Nobody can.

Liminal answers both. **Eight bounded Opus 4.8 agents** read the team's AI spend against its OKRs and
**disagree** about what's waste. A **fresh adversarial reviewer** then cross-checks every claim against the
evidence and **drops the ones that don't survive** — it caught its own side's $162 "calendar" charge
(PR-103 proved it was real product work), cutting a naïve **$446** estimate to a verified **$284**. Every
finding is hash-linked to its source rows and **anchored**; when an operator ratifies a policy, the
decision enters an **append-only provenance chain** that corrections never overwrite. The subject of the
system is the **agent fleet and the spend — never the person.** We dogfooded it on our **own $8,228** of
Claude spend from building this.

### The one moment that proves it
On screen, live: the misuse pass flags E14 as routable "calendar admin" waste → the adversarial reviewer
**refutes it** (PR-103 shows it's real product engineering) → **the model drops its own claim** →
`$446 → $284` → operator ratifies "Opus 4.8 ≠ calendar management → use **CalendarOps**" → the decision is
**anchored to the chain.** A test (`tests/reconcile.test.js`) **fails closed** if that drop is ever undone.

---

## 💡 Why this is infrastructure, not a wrapper *(for the VCs in the room)*
1. **Governance *without* surveillance — structural.** The subject is the agent fleet and the spend, never
   the employee. There's no people-monitor to turn on: *you can't misuse what the architecture can't
   express.*
2. **Counter-cyclical.** Every other AI tool weakens as models improve (better model → less need for the
   wrapper). Liminal **strengthens**: sharper models produce sharper disagreements → a richer record. *We
   run toward superintelligence, not away from it.*
3. **The correction stream is the moat.** AI gives infinite answers; the **record of which ones you
   trusted** compounds and can't be cloned from the outside.
4. **The layer pattern.** Ancestry (identity under DNA) · Robinhood (settlement under trading) · Cloudflare
   (network under security) · Asana (coordination under tasks) · **Liminal (the verified-decision layer
   under AI-native operations).** Find the invisible layer; the surface above works better.
5. **Wedge → company.** The **wedge is AI spend.** The **company is the operator-intelligence control
   plane** — one loop (Capture → Read → Decide → Record → Re-enter), **swappable subject.** AI spend is one
   subject; the desktop shell runs the same loop across the whole operation.

*Credibility: lead architecture **patent filed** (US Provisional 64/080,639); the architecture took **1st
place, Infrastructure track, at the Algorand x402 Berlin hackathon.** Demand is discovery — six operators,
founders to directors, voiced this exact pain.*

---

## What it does — a governance *workflow*, not a dashboard
The app shows a Tray, a Slate, a decision trail, and a report — but **the product is the workflow**, not the
charts. (A dashboard-as-the-main-feature is explicitly *not* what this is.)

`liminal setup` → map AI usage to **OKRs** → pull diffuse context into a hardened working set → **bounded
agents deliberate** over spend/usage/agent-fit/risk → an adversarial reviewer **refutes weak claims** →
surface a quantified finding → recommend a **better verified internal agent** (trustless registry) →
**ratify a decision** into a **provenance trail** team agents reference going forward → generate an
exec-ready **AI Spend Brief**.

## Architecture
| Layer | What it does | Where |
|---|---|---|
| **Claude Code plugin** | installs Liminal, runs setup, connects existing context/MCPs | `plugin/` |
| **Desktop / web cockpit** | operator surfaces: Tray, Slate, decisions, reports (the Agency-shell IA) | `app/` |
| **Governance engine** | deterministic spend analysis + bounded Opus cap-enforcement | `engine/` |
| **Provenance chain** | hash-linked, append-only decision/policy trail + receipts | `provenance/` |
| **Deliberation workflow** | bounded agents analyze spend/usage/agent-fit/risk, then self-verify | `.claude/workflows/` |
| **MCP server** | exposes the engine + provenance as governance tools in the terminal | `mcp/` |
| **Trustless agent registry** | recommends better/verified internal agents | `app/` (reused) |

## Repo map
- `plugin/` — the Claude Code plugin (front door + `liminal setup` + onboarding swarm). **Stream S2.**
- `provenance/` — clean local-first provenance chain (hash-linked log, anchor receipts, corrections,
  decision/policy packets). **Stream S1.** *(Clean reimplementation — prior art is patent-protected and not
  in this repo; see `CONTRIBUTIONS.md`.)*
- `engine/` — the AI Spend Governance engine: deterministic analysis, provenance-anchored savings findings,
  and a bounded Opus agent that enforces a spend cap (judges decisions, not people).
- `app/` — the public web governance cockpit (the converged-IA Agency shell, live-wired to real provenance).
- `.claude/workflows/` — the saved dynamic workflow + its deterministic core + the done-gate. **Stream S4.**
- `data/` — the seeded AI-usage governance fixture.
- `BRIEF.md` · `rubric.md` — the problem brief + the model-gradable "done" criteria.
- `SESSION_LOG.md` — a judge-readable transcript of a real run. `ORCHESTRATION.md` — how Claude built it.
- `CONTRIBUTIONS.md` — what was built today vs. prior art. `SUBMISSION_CHECKLIST.md` — the pre-submit gate.

## Run the `/spend-audit` demo
```bash
# 1. Build the provenance chain the workflow anchors into (one-time; needs network for deps):
npm --prefix provenance install && npm --prefix provenance run build

# 2. Run the audit on the seeded fixture → regenerates out/report.json (deterministically):
node .claude/workflows/spend-audit.mjs data/usage-events.csv
#    ↳ Opus 4.8 spend $4,500 · security 24% vs 40% · naïve $446 → verified $284 (E14 dropped via PR-103)

# 3. Re-run on a fresh dataset in one command (rerunnability — the Orchestration ask):
node .claude/workflows/spend-audit.mjs data/q3/usage-events.csv out/report-q3.json
```
The full dynamic workflow judges score is `.claude/workflows/spend-audit.js`, invoked in Claude Code as
`/spend-audit on data/usage-events.csv` (8 deliberation agents + the adversarial reviewer run `model: opus`).

## How "done" is verified (no human in the loop)
"Done" is gated against `rubric.md` + the test suites — the model grades itself; the workflow only emits
success when all five rubric checks hold. **One green run verifies the whole submission:**

```bash
npm test          # unified gate → test-all.mjs runs every governance sub-suite in one command
```

| Suite | What it proves | Count |
|---|---|---|
| **root** | the 5 `rubric.md` checks: OKR baseline · classification · misalignment · ratified decision anchored · report reconciles to $284 ±$1 | 12 |
| **plugin** | plugin manifest + consent gate, bounded-agent refusal, `/try-liminal` deliberation, correction round-trip, onboarding swarm | 14 |
| **provenance** | hash determinism + golden vector, chain integrity + byte-flip tamper detection, INSERT-only immutability, reconcile ±$1, local-first anchoring, contract drift-guard | 22 |
| **engine** | deterministic `analyze` + reconcile, provenance-`anchor` of findings, the bounded `enforceCap` agent's cap/out-of-lane refusals | 16 |
| **app** | the cockpit's coherence gate: its displayed numbers reconcile to `report.json` ($284 · E14 dropped) so the **live cockpit can't drift from the pitch** | 5 |

All green = **69 checks across 5 suites** (one `engine` live-Opus assertion auto-skips without
`ANTHROPIC_API_KEY` → CI runs **68 pass + 1 skip**). `.github/workflows/ci.yml` runs the same `npm test`
on every push/PR (Node 22) — the badge above is live. The deterministic core regenerates `out/report.json`
**byte-identically** on a re-run, so anyone can re-verify "done" tomorrow on a fresh dataset.

## Run the cockpit locally
```bash
cd app && npm install && npm run dev     # → http://localhost:5173
```
See `app/README.md` for the screen map and the provenance data-seam.

## How it was built (orchestration)
The product is built and verified by a **dynamic Claude Code workflow** running on Opus 4.8: bounded
specialist agents deliberate, an adversarial reviewer refutes weak claims, and the workflow gates "done"
against `rubric.md` + the test suites — no human in the verification loop. An orchestrator integrated every
build lane through **PR-gated merges**, keeping `main` green with CI on every PR. Full write-up:
[`ORCHESTRATION.md`](ORCHESTRATION.md) · [`SESSION_LOG.md`](SESSION_LOG.md).

## Honest scope
Provenance is **local-first by default** (the on-chain Algorand anchor path is env-gated and never blocks
the chain). Demand is **discovery, not closed pilots.** Prior art (the private Liminal substrate) is
**patent-protected and not in this repo** — `provenance/` is a clean reimplementation (`CONTRIBUTIONS.md`).
The model is **Claude Opus 4.8** (`claude-opus-4-8`). Governance judges the **agents' work and the spend,
never the people.**

## License
MIT — see `LICENSE`.
