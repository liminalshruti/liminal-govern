# Contributions — built today vs. prior art

> **Read this for judging.** Per the Build Day rules, the demo highlights only what we built during the
> event, and prior work is clearly distinguished. This repo is the standalone, extractable submission.

## Built during the event (2026-06-13) — the submission
- **`provenance/`** — the local-first provenance chain (hash-linked append-only log, anchor receipts,
  correction re-anchoring, decision/policy packets). Written fresh today.
- **`plugin/`** — the Claude Code plugin: `liminal setup`, the onboarding swarm, the SessionStart
  desktop-install hook, the bounded agent definitions, the `marketplace.json`. Authored today.
- **`.claude/workflows/`** + **`rubric.md`** + **`tests/`** — the dynamic deliberation workflow
  (8 bounded spend-governance agents + adversarial review) and the model-verifiable "done" gate.
- **`app/`** — the governance cockpit surfaces built today: OKR baseline, Tray→Slate, the deliberation
  + finding view, the ratify/provenance view, the AI Spend Brief. Plus integration of the trustless
  agents UI (see prior art).
- **`data/`** — the synthetic AI-usage governance fixture.
- The end-to-end integration tying these into the demo flow.

## Prior art (clearly distinguished — NOT claimed as today's work)
- **Public base, MIT — `liminalshruti/liminal-agents`:** bounded-agent architecture + refusal +
  SQLCipher vault concepts. Where reused, it's vendored/adapted and noted in-file.
- **Public, MIT — `liminalshruti/algorand-berlin-2026`:** the **trustless-agents UI** (the agent
  registry/marketplace surface) and the hash-only anchoring helpers (`txidToBytes`/`isZero`). Reused +
  restyled today; clearly a prior hackathon asset, integrated into this flow during the event.
- **Architecture concepts** from the private Liminal product repos (`liminal-desktop`,
  `liminal-agents-v1`) — the provenance/correction/bounded-refusal patterns are PPA-protected prior art
  (US Provisional 64/080,639). **Their source is NOT included in this repo;** `provenance/` is a clean
  reimplementation written today.

## Model
Built with **Claude Opus 4.8** (`claude-opus-4-8`) via Claude Code dynamic workflows. (The demo's
fictional scenario references an early-access frontier model for flavor; we build with Opus 4.8.)
