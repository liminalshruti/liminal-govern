# @liminal-govern/engine

The **AI Spend Governance engine** for founder/operators. Three beats, all evidence-first:

1. **`analyze()`** — deterministically recompute seat utilization from raw activity and emit
   `SavingsFinding[]` that each cite their source rows. The per-finding savings reconcile to a
   headline total.
2. **`anchorFindings()`** — commit each finding to the local-first **provenance chain** (S1 lib) so
   the report's claims are hash-linked and tamper-evident.
3. **`enforceCap()`** — a **bounded Opus agent** that refuses any spend decision over the ratified
   cap or out-of-lane. *Governance without surveillance: it judges spend decisions, not people.*

> Decision artifacts with citations — not a dashboard.

## Install & verify

```bash
# 1. Build the provenance lib this engine anchors into (sibling package):
npm --prefix ../provenance install && npm --prefix ../provenance run build

# 2. Install + verify the engine:
npm install
npm run typecheck     # clean
npm test              # analyze determinism, reconcile ±$1, enforceCap refusals (+ live Opus)
npm run build         # emits ./dist
```

`enforceCap` and the `LIVE` test read `ANTHROPIC_API_KEY` from the environment and call
**`claude-opus-4-8`**. The live test self-skips if the key is absent; everything else runs offline.

## CLI

```bash
engine analyze [fixture]      # recompute utilization → findings + reconcile total
engine anchor  [fixture]      # anchor findings to the chain, run verifyChain(), print receipts
engine enforce --cap <n>      # bounded Opus agent rules on spend decisions against the cap
                              #   optional: --decisions <path.json>
```

`fixture` is a known name (`q2-spend` — default — or `sample-spend`) or a path to a spend CSV.
During development run via tsx, e.g. `npm run analyze -- sample-spend` or
`node --import tsx src/cli.ts enforce --cap 1500`.

### Example

```
$ engine analyze
  [LOW] Q06 Vercel   4/12 seats  33.3%  $2400/mo
  ...
  F-Q06 [Q06] Vercel @ 33.3% → save $1600/mo
      Downgrade or cancel Vercel: only 4/12 seats active in 30d — drop 8 idle seats
  Monthly savings total: $5104
  Reconcile (sum vs total, ±$1): OK (sum=$5104, delta=$0)

$ engine enforce --cap 1500
  DEC-02 [$2400/mo] → REFUSE/over-cap   The $2400 commit exceeds the ratified $1500 cap…
  DEC-03 [$200/mo]  → REFUSE/surveillance  Per-employee monitoring is surveillance of people…
```

## API surface (what S4 / the report layer calls)

```ts
import {
  analyze,            // (fixture?) => AnalysisReport { utilization[], findings[], monthly_savings_total }
  anchorFindings,     // (findings, opts?) => Promise<{ log: ProvenanceLog, receipts: AnchorReceipt[] }>
  reconcileFindings,  // (findings, total, tol=1) => ReconcileResult  (lib reconcile, ±$1)
  enforceCap,         // (cap, decisions, opts?) => Promise<EnforcementVerdict[]>
  applyCapGuard,      // pure, deterministic cap ceiling (tested offline)
  makeOpusRuling,     // build a live Opus ruling fn from an Anthropic client
  ProvenanceLog,      // re-exported seam: log.verifyChain() === { ok: true, ... }
} from "@liminal-govern/engine";
```

- **`analyze(fixture?)`** — pure & deterministic. Joins spend × seat-activity on `row_id`,
  recomputes `utilization_pct = active_seats_30d / seats_purchased`, and emits a finding for every
  vendor below the 70% health threshold. `monthly_savings` is computed from the idle-seat share of
  the real monthly cost, so the findings sum to `monthly_savings_total` exactly.
- **`anchorFindings(findings)`** — wraps each finding as a `kind:"finding"` `Packet` (its `context`
  carries the cited `source_row_ids` + recomputed utilization), appends it via the lib's
  `ingestPacket`, and returns the local `AnchorReceipt`s. The returned `log` is left open;
  `log.verifyChain()` walks the hash-link and re-hashes every stored payload — tampering with any
  finding byte breaks the chain. Call `log.close()` when done.
- **`enforceCap(cap, decisions)`** — one bounded, **forced-tool** Opus call per decision
  (`tool_choice` → `record_verdict`; extended thinking is intentionally **off** in that call — the
  two are incompatible). The ratified cap is also enforced arithmetically: if the model ever
  approves an over-cap decision, a deterministic guard overrides it to a refusal. Refusal kinds:
  `over-cap`, `out-of-lane`, `surveillance`.

## How it imports `../provenance`

The provenance chain is a self-contained sibling package. The engine touches it through exactly one
seam — `src/provenance.ts` — which re-exports the lib from its built output at
**`../provenance/dist`**. Build the lib first (above). Wire types (`Packet`, `AnchorReceipt`,
`SavingsFinding`, …) come from that same lib, which mirrors `coordination/contract.ts` field-for-field.

## Determinism & secret hygiene

`analyze()` is a pure function of its fixtures — two runs are byte-identical (enforced by a test).
The API key is read only from `process.env.ANTHROPIC_API_KEY` and never written to any tracked file.
