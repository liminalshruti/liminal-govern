# provenance/ — Stream S1: the provenance chain (clean, local-first)

The decision/policy + finding ledger. Built fresh today; a clean reimplementation of the
PPA-protected architecture (no private source).

**Build:** a small TypeScript lib + CLI.
- Canonical hash (`stableStringify` → SHA-256 over a canonical payload excluding anchor fields).
- Append-only, **hash-linked** log (SQLite); `verifyChain()` walks + asserts `prev_hash`.
- Anchor receipts (local-first by default; on-chain env-gated — lift `txidToBytes`/`isZero` from the
  public `algorand-berlin-2026`).
- **Decision/policy packet kind** (the ratified-decision entry with `agent_policy` + `approved_alternative`).
- Correction = a new linked entry, never a mutation.
- Object model: OKR → Tracking stream → Usage event → Agent → Decision → Evidence → Risk → Owner →
  Metric → Outcome.
- CLI: `provenance ingest|verify|show|correct|ratify`.

**Wire types:** import from `../coordination/contract.ts`. **Done:** hash determinism · chain
integrity (tamper test fails) · immutable corrections · local-first (no network). Full spec lives in
the private founder-brain stream doc `ops/build-day/streams/S1_PROVENANCE_CHAIN.md`.
