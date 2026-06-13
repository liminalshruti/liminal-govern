# app/ — Liminal Govern cockpit (web)

The operator cockpit for **AI spend governance for founder/operators**. Web app
(Vite + React + TypeScript), deployable to Vercel. No Tauri.

This is a **real, deployable build**: app shell + routing, a hero that opens on the
governance beat, the cockpit screens, and the durable part — a **provenance
data-seam** that reads the engine's real report and runs the correction loop live
in the browser.

## Single source of truth: `out/report.json`

The cockpit reads the **same artifact the S4 deliberation workflow and the pitch
deck use** — the engine's **`../out/report.json`** — so the numbers on screen are
byte-identical to the numbers on stage. This is **AI-spend governance**, not a
seat-utilization dashboard:

- Every Opus 4.8 call is **classified against the team's OKRs**.
- Off-objective work is **routed to registry-verified, lower-cost agents**
  (CalendarOps, DigestBot — ~10% of Opus cost).
- Every finding **cites its evidence rows and carries a provenance anchor**.
- One over-claim (**E14 → $162**) was **refuted by adversarial review (PR-103)** and
  **dropped** — so we only anchor what survives. That disagreement → correction is
  the governance beat.

### How it's baked in

`npm run build` fires the **`prebuild`** hook (`scripts/prebuild.mjs`), which copies
**`../out/report.json` → `src/generated/report.json`** (committed, so an app-only
deploy like Vercel — where `../out` is absent — ships the same artifact). The cockpit
loads it through the provenance seam (`src/lib/report.ts` + `src/lib/provenance.ts`).

```bash
npm run bake   # re-copy out/report.json → src/generated/report.json (same as prebuild)
```

The headline figures the cockpit shows (all from `report.json`):

| Figure | Value |
|---|---|
| Opus 4.8 spend (period 2026-06) | **$4,500/mo** |
| Ratified, evidence-backed savings | **$284/mo** |
| Naive savings (pre-review) | $446/mo |
| Over-claim refuted & dropped (E14, PR-103) | **−$162** |
| Security-hardening allocation | 24% actual vs 40% target |
| Approved alternatives | CalendarOps, DigestBot |
| Ratified cap | *"Opus 4.8 cannot be used for calendar management or routine admin work."* |

## Run

```bash
cd app
npm install
npm run dev        # → http://localhost:5173
npm run build      # prebuild (bake report.json) + tsc -b && vite build
npm run typecheck  # tsc --noEmit
npm run preview    # serve the production build
```

## Fallback demo screenshots

`scripts/capture-beats.mjs` (Playwright) builds + serves the bundle and screenshots
the 4 hero beats into **`app/demo-shots/`**, so the demo survives a live Vercel blip.

```bash
npx playwright install chromium   # one-time browser download
npm run build
npm run capture-beats             # → app/demo-shots/*.png
```

Beats captured: `0-hero` · `1-spend-overview` · `2-finding-provenance` ·
`3-correction-reanchor` · `4-governance-cap`.

## Screens

Hero lives at `/`; the cockpit screens live inside the shell (left nav, in pitch order).

| Route          | Screen                          | What it shows (from `report.json`) |
|----------------|---------------------------------|------------------------------------|
| `/`            | Hero / landing                  | the beat: agents disagree → operator corrects → only the survivor is anchored; headline numbers |
| `/spend`       | Spend overview (**beat 1**)     | Opus 4.8 spend classified by category against the OKRs; security 24% vs 40% callout |
| `/findings`    | Findings & corrections (**beats 2+3**) | the refuted E14 claim up top; evidence-backed findings each citing usage events + SHA-256 anchor receipt; a chain-integrity badge; a Correct button that appends a real linked correction and re-anchors live |
| `/governance`  | Governance & cap (**beat 4**)   | the ratified cap-refusal (allowed vs refused policy), approved alternative, referenced context, per-entry chain verification |
| `/agents`      | Approved agents                 | the registry-verified, lower-cost agents off-objective work is routed to |
| `/decisions`   | Decision log                    | append-only trail: anchored findings + the dropped claim + the ratified decision + live corrections |

## The provenance data-seam (the durable part)

`src/lib/report.ts` types + loads the baked `report.json`. `src/lib/provenance.ts`
is the single seam every screen reads through. Stable API:

- `listProvenance()` / `loadProvenance(id)` → live findings as `ProvenanceView` (finding + cited usage events + `AnchorReceipt` + verify state)
- `listDropped()` → the refuted/dropped claims (E14) with their drop reason
- `submitCorrection(draft)` → appends a `Correction` (never mutates)
- `listCorrections()` / `verifyChain()` → corrections trail + per-link hash-chain integrity

Each live finding (the refuted claim excluded) plus the ratified decision becomes a
contract `Packet`, hash-linked into the chain — 6 anchored entries, mirroring
`report.json#provenance.anchored`.

## Browser-native provenance chain (`src/lib/chain.ts`)

The provenance + correction loop runs **LIVE in the browser**. The canonical
provenance library (`../provenance/`) is Node-only (it links `better-sqlite3`), so
`chain.ts` mirrors its hash scheme **exactly**:

- `stableStringify` — sorted object keys at every level, arrays preserved in order.
- `canonicalPacketPayload` — schema-tagged (`liminal.provenance.v1`),
  anchor-fields-excluded, ordinal-sorted reads, optionals resolved to explicit `null`.
- SHA-256 over that canonical string → lowercase hex (WebCrypto `crypto.subtle`).

On top of the hash, `chain.ts` mirrors `provenance/src/log.ts` + `correct.ts`: an
**append-only, hash-linked** event log (`localStorage`-persisted instead of SQLite),
`anchorLocal` receipts, **corrections as new linked entries that re-anchor** (never
mutations), and `verifyChain()` (re-hash each payload + check every `prev_hash`).

The findings screen renders finding → cited usage events → SHA-256 anchor receipt →
Correct. Clicking **Correct** appends a correction (persisted), and the correction
trail + the chain-integrity badge re-render live — the badge stays green because the
new entry re-anchors cleanly.

Wire types live in `src/lib/contract.ts`, copied/adapted from the canonical
`coordination/contract.ts` at the repo root. Keep them in sync.

## Deploy

`app/vercel.json` pins the build (`framework: vite`, `buildCommand: npm run build`,
`outputDirectory: dist`, SPA `rewrites`). Set Vercel **Root Directory = `app/`**; the
committed `src/generated/report.json` means `prebuild` ships the baked artifact even
though `../out` isn't present there.

```bash
npx vercel deploy --prod        # from app/ (needs VERCEL_TOKEN for non-interactive)
```
