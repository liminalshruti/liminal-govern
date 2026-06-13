# provenance — local-first provenance chain (S1)

The provenance lane of `liminal-govern`. A self-contained, **local-first provenance chain** as a
small TypeScript library, vendored here as `liminal-govern/provenance/` (the standalone
`liminal-provenance` repo it was ported from is retired; this is the home).

A producer (a bounded agent, an audit step, any process) emits a **finding/packet**. Each packet
is **canonically hashed**, appended to an **append-only, hash-linked log**, and given an **anchor
receipt** (local-first by default, optional on-chain). A **correction** to any entry is itself a
new linked entry that **re-anchors** — never a mutation. Click a finding and it expands to its
cited source, its anchor, and its full correction history: **evidence, not assertion.**

> The correction loop IS the product, made literal: corrections are first-class entries in the
> same chain as the things they correct.

License: MIT. No private packages imported, no private source copied.

## Install / run

```bash
npm install
npm run typecheck      # tsc --noEmit, clean
npm test               # node:test suite, 18 tests
npm run build          # emit dist/ (CLI bin = dist/cli.js)
```

## The chain

Each row stores the canonical hash of its own payload and a link to the previous row's hash. The
link makes the log tamper-evident: change any byte of any payload and that row's hash no longer
matches, breaking the chain at exactly that index.

```
            ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
 genesis ─▶ │ events[0]            │   │ events[1]            │   │ events[2]  (CORRECTION)│
            │ packet_id  find_figma│   │ packet_id  find_notion│   │ source_packet_id=     │
            │ packet_hash  H0      │◀──┤ prev_hash  H0        │◀──┤   find_figma          │
            │ prev_hash    null    │   │ packet_hash  H1      │   │ prev_hash    H1       │
            └──────────────────────┘   └──────────────────────┘   │ packet_hash  H2       │
                    │                          │                   └──────────────────────┘
                    ▼                          ▼                          │
              AnchorReceipt              AnchorReceipt                     ▼
              local-first                local-first                AnchorReceipt (re-anchor)

 verifyChain(): for each row i  ─ rehash(payload[i]) == packet_hash[i]   (self-consistency)
                                ─ prev_hash[i]        == packet_hash[i-1] (link, null at genesis)
```

INSERT-only. There is no `update` or `delete` on the log API — appending is the sole mutation.
A correction does not edit the original row; it appends a new `finding` packet whose
`source_packet_id` points back at what it corrects, then re-anchors.

## Hash scheme

`computePacketHash({ packet, reads })` = **SHA-256 hex** over a **canonical payload**:

1. `canonicalPacketPayload` builds a fixed, enumerated field list from the `Packet` + `AgentRead`
   contract shapes. Optional fields resolve to explicit defaults (absent === `null`), and `reads`
   are sorted by `ordinal`. A schema tag `"liminal.provenance.v1"` is part of the input so a
   future schema bump can never collide with v1 hashes.
2. `stableStringify` serializes it with object keys sorted at every level, so the hash is
   independent of object-literal key insertion order. Arrays preserve order (read order is already
   normalized by the `ordinal` sort).
3. SHA-256 over the UTF-8 bytes → 64-char lowercase hex.

**Anchor fields are excluded by construction** — `Packet`/`AgentRead` carry none. Anchoring
decorates a stable identifier; it never redefines the artifact. Determinism is the contract: the
same logical packet always produces the same hash regardless of how it was assembled or fetched.
A golden-vector test locks the scheme.

## Local-first vs on-chain toggle

| | local-first (default) | on-chain (opt-in) |
|---|---|---|
| trigger | always | `ANCHOR_URL` env set |
| receipt | `anchor_chain:"local"`, `anchor_network:"local-first"` | `anchor_chain:"algorand"`, `anchor_network` from the endpoint, `anchor_txn_id` set |
| network | none | best-effort POST to `ANCHOR_URL` |
| failure | n/a | returns `null` — **never blocks the chain** |

The whole test suite and CLI run with **no network and no chain**. The on-chain path is exercised
only when `ANCHOR_URL` is set; if it is unset or the endpoint is down, the local receipt still
stands and the chain proceeds. The proof shape is validated with `txidToBytes()` + `isZero()`
(32 raw bytes, non-zero) before any anchor is minted.

## CLI

```bash
export PROVENANCE_DB=provenance.db          # default ./provenance.db
provenance ingest fixtures/findings.json    # append packets/findings + anchor each
provenance verify                           # walk the chain, assert integrity
provenance show find_figma                  # finding + reads + anchor + correction trail
provenance correct find_figma "utilization recomputed at 35%"   # linked correction + re-anchor
```

(During development, invoke via `npm run cli -- <args>` or `node --import tsx src/cli.ts <args>`.)

## Reconciliation hook (spend use case)

`reconcile(findings, total, tolerance = 1)` asserts the sum of `monthly_savings` across
`SavingsFinding` rows equals a reported `total` within ±$1. Findings cite their raw source rows,
so a headline savings number is checkable against the lines that produced it.

## Public API

```ts
// hash
stableStringify, canonicalString, canonicalPacketPayload, computePacketHash, sha256Hex, PACKET_HASH_SCHEMA
// log
class ProvenanceLog { append, verifyChain, all, byId, byPacketId, correctionsOf, saveReceipt, receiptsFor, lastHash, close }
type VerifyResult
// anchor
anchorLocal, anchorOnchain, txidToBytes, isZero, assertValidProof, PROOF_BYTE_LEN
// operations
ingestPacket, correct, reconcile, hashOf
// types (mirror coordination/contract.ts)
Packet, AgentRead, AnchorReceipt, Correction, PacketKind, CorrectionKind,
SpendLineItem, SeatActivity, SavingsFinding, ChainEvent, AppendInput
```

## Types: mirrored from the canonical contract (with a drift guard)

The shared wire types (`Packet`, `AgentRead`, `AnchorReceipt`, `Correction`, `PacketKind`,
`CorrectionKind`, `SpendLineItem`, `SeatActivity`, `SavingsFinding`) live canonically in
[`../coordination/contract.ts`](../coordination/contract.ts) — the single source of truth all
streams share. `src/types.ts` **mirrors** those shapes field-for-field (verified byte-identical,
sans comments, by `tests/contract.test.ts`), and adds only this library's internal log shapes
(`EventKind`, `ChainEvent`, `AppendInput`).

They are mirrored rather than imported on purpose: `provenance/` is a **self-contained,
extractable package**. A `../coordination` source import would put a file outside this package's
`rootDir` (`tsc` TS6059) and would drag `coordination/` along with any extraction — defeating
self-containment. The `contract.test.ts` drift guard reads the contract as text at test time
(no module import) and fails if any shared shape diverges, so the mirror can never silently drift;
any change is reconciled **toward** the contract.

## Provenance: lifted vs re-implemented (prior art)

This is a **clean-room** re-implementation. Architecture mirrors existing Liminal primitives; no
private source is copied verbatim and no private package is imported.

- **`txidToBytes()` + `isZero()`** — intended lift from `algorand-berlin-2026/apps/router/src/onchain.ts`
  (public, MIT, pure, zero-dependency). The source file was not present in this workspace at build
  time, so these were re-implemented fresh from the documented contract: validate a **32-byte,
  non-zero proof shape**. They are pure and dependency-free.
- **Canonical packet-hash scheme** — mirrors the *shape* of
  `liminal-agents-v1/lib/substrate/packet-hash.ts`: `stableStringify` → SHA-256 over a canonical
  payload that **excludes anchor fields**, with a schema tag and ordinal-sorted reads. Written
  fresh here (uses Node's `crypto` rather than a hand-rolled SHA-256; field list aligned to the
  `contract.ts` shapes, not the desktop dist's richer schema).
- **Append-only event log** — concept from the `liminal-desktop` event-log crate (INSERT-only,
  hash-linked rows, walk-to-verify). Re-implemented over `better-sqlite3`.
- **Anchor-receipt type + correction linkage (`source_packet_id`)** — wire shapes mirror
  [`../coordination/contract.ts`](../coordination/contract.ts), the shared contract this library
  seeds (see "Types: mirrored from the canonical contract" above). A drift-guard test enforces
  the mirror stays identical.

## Out of scope (next)

On-chain settlement and a real Algorand deploy (kept env-gated/stubbed), privacy-invariant static
scans, and agent geometry are deliberately out of scope. The `anchorOnchain` path is the seam S4
fills in with a real anchor service.
