# Contributions — built today vs. prior art

> **Read this for judging.** Per the Build Day rules, the demo highlights only what we built during the
> event, and prior work is clearly distinguished. This repo is the standalone, extractable submission.

## Built during the event (2026-06-13) — the submission
- **`provenance/`** — the local-first provenance chain (canonical packet hashing, append-only
  hash-linked SQLite log, local/on-chain anchor receipts, corrections-as-new-entries that
  re-anchor). Self-contained TypeScript package: `npm test` → 22 green (hash determinism + golden
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
- **`plugin/`** — the Claude Code plugin front door, vendored + reimplemented today. The
  plugin-facing surface (`plugin.json`/`marketplace.json` with `defaultEnabled:false`, the
  SessionStart desktop-install hook + onboarder, the `/try-liminal` taste skill + command, the three
  bounded agent definitions, the integration test) was ported from the prior-art `liminal-agents`
  `build-day/s2-plugin-front-door` work. The private substrate it depended on was **reimplemented
  clean and public-safe**, not copied — see the plugin breakdown under Prior art below.
- **`.claude/workflows/`** + **`rubric.md`** + **`tests/`** — the dynamic deliberation workflow
  (8 bounded spend-governance agents + adversarial review) and the model-verifiable "done" gate.
- **`app/`** — the governance cockpit surfaces built today: OKR baseline, Tray→Slate, the deliberation
  + finding view, the ratify/provenance view, the AI Spend Brief. Plus integration of the trustless
  agents UI (see prior art).
- **`engine/`** — the AI Spend Governance engine, written fresh today (merged from the
  `build-day/engine` lane). Three evidence-first beats: `analyze()` deterministically recomputes seat
  utilization from raw activity and emits `SavingsFinding[]` that each cite their source rows and
  reconcile to a headline total; `anchorFindings()` commits each finding into the local-first
  provenance chain (reuses the `provenance/` S1 lib) so claims are hash-linked and tamper-evident;
  `enforceCap()` is a **bounded Opus agent** that refuses any spend decision over the ratified cap or
  out-of-lane (governance without surveillance — it judges spend decisions, not people). Self-contained
  TypeScript package on `@anthropic-ai/sdk`; `npm test` covers deterministic `analyze`/reconcile and
  injected-ruling cap refusals, plus one live-Opus assertion that auto-skips without
  `ANTHROPIC_API_KEY`. Wired into the unified root `npm test` gate (runs after `provenance/`, whose
  built dist it imports).
- **`data/`** — the synthetic AI-usage governance fixture.
- **`mcp/`** — a stdio [MCP](https://modelcontextprotocol.io) server exposing the spend-governance
  `engine/` + `provenance/` chain as Claude-session tools (run a spend audit, verify the chain, get a
  finding, inspect corrections) — so **any** Claude session can govern spend without reimplementing
  either. Additive: it wraps the existing packages and modifies neither. Written fresh today.
- **`managed/`** — a **Managed Agent** that runs the spend-audit workflow on a schedule (server-side,
  async): the "this scales" beat past the on-demand MCP tool. Ships a working `agent.json` + a verifiable
  offline `--dry-run`; reuses `engine/` + `provenance/`, reimplements neither. Written fresh today.
- The end-to-end integration tying these into the demo flow.

## Prior art (clearly distinguished — NOT claimed as today's work)
- **Public base, MIT — `liminalshruti/liminal-agents`:** bounded-agent architecture + refusal +
  SQLCipher vault concepts. Where reused, it's vendored/adapted and noted in-file. The `plugin/`
  front door derives from its `build-day/s2-plugin-front-door` branch. To keep this repo public-safe,
  the private substrate that branch imports was **stubbed / clean-reimplemented**, not copied:
  - **Vendored verbatim (already public-safe):** `.claude-plugin/plugin.json` +
    `marketplace.json`, `hooks/hooks.json`, `bin/liminal-plugin-onboard.js`,
    `agents/liminal-{analyst,auditor,sdr}.md`, `commands/try-liminal.md`, the `try-liminal` SKILL.md,
    `lib/correction-tags.js`, `lib/vault/ids.js`, `lib/auth.js`, `lib/anthropic-cli-shim.js`.
  - **Reimplemented clean today (private internals stubbed):**
    - `lib/vault/db.js` — the private vault is a **SQLCipher** db (`better-sqlite3-multiple-ciphers`)
      behind a Keychain-backed keyguard (`lib/vault/{crypto,keyguard,secure-erase,path,schemas}.js`).
      Replaced with a **plain, non-encrypted** "taste vault" on Node's built-in `node:sqlite`, with
      only the 4 tables the loop needs. No crypto, no Keychain, no key material ships.
    - `lib/agents/index.js` + `defs.js` + `bounded-system-prompt.js` + `validation.js` +
      `agency-dag.js` — the private registry ships **two 12-agent sets** (an introspective
      polarity-clock + a workflow-DAG agency set) and imports `archetype-base.js` / `agency-base.js`.
      Reimplemented as a **3-agent** (Analyst/SDR/Auditor) registry with a minimal DAG slice; the
      bounded-refusal allowlist + classifier logic is preserved, the private geometry modules are not.
    - `lib/anthropic-client.js` — rewritten to be **zero-dependency**: it lazy-loads
      `@anthropic-ai/sdk` only if present, else falls back to the `claude` CLI shim, so the plugin
      vendors with no `node_modules`.
    - `skills/try-liminal/run.js` + `skills/check/store-correction.js` — re-pointed at the public-safe
      plain vault and the async client; the fixture-fallback + correction round-trip are preserved.
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
