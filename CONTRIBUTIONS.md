# Contributions — built today vs. prior art

> **Read this for judging.** Per the Build Day rules, the demo highlights only what we built during the
> event, and prior work is clearly distinguished. This repo is the standalone, extractable submission.

## Built during the event (2026-06-13) — the submission
- **`provenance/`** — the local-first provenance chain (canonical packet hashing, append-only
  hash-linked SQLite log, local/on-chain anchor receipts, corrections-as-new-entries that
  re-anchor). Self-contained TypeScript package: `npm test` → 18 green (hash determinism + golden
  vector, chain integrity with byte-flip tamper detection, INSERT-only immutability, reconcile
  ±$1, local-first no-network anchoring, and a contract drift-guard); `npm run typecheck` clean;
  CLI `ingest | verify | show | correct`. Written fresh today.
  - Wire types **mirror** `coordination/contract.ts` (the shared contract) field-for-field; a
    `tests/contract.test.ts` drift guard enforces the mirror stays identical and any change is
    reconciled toward the contract. Mirrored — not imported — to keep `provenance/` extractable
    and self-contained.
  - **Prior art, re-implemented clean — NO private source copied:** the canonical packet-hash
    scheme (`stableStringify` → SHA-256 over an anchor-excluded canonical payload, schema-tagged,
    ordinal-sorted reads) mirrors the *shape* of `liminal-agents-v1`'s packet-hash primitive; the
    append-only hash-linked log mirrors the *concept* of the `liminal-desktop` event-log crate
    (INSERT-only, walk-to-verify). Both written fresh over Node `crypto` + `better-sqlite3`. The
    anchor proof-shape helpers (`txidToBytes`/`isZero`) are clean re-implementations of the public
    MIT `algorand-berlin-2026` hash-only anchoring helpers.
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
