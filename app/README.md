# app/ — Liminal Govern cockpit (web)

The governance cockpit for **AI spend governance for founder/operators**. Web app
(Vite + React + TypeScript) so lane G can deploy it to Vercel. No Tauri.

This is a **real, deployable build, not a throwaway**: app shell + routing, the 6
cockpit screens, a hero landing screen, and — the durable part — the **provenance
data-seam** that now serves **real Node-engine output baked in at build time**.

## Real engine output, baked at build time

The engine (`../engine`) is Node-only (it links `better-sqlite3` via `../provenance`)
and the cockpit is a static browser bundle, so they are wired at **build time**:

- `npm run build` fires the **`prebuild`** hook (`scripts/prebuild.mjs`), which — when
  the `../engine` + `../provenance` siblings are present — builds the provenance lib,
  builds the engine, then runs **`scripts/generate-findings.mjs`**. That script runs the
  REAL engine: `analyze("q2-spend")` recomputes seat utilization from `data/` into
  `SavingsFinding[]`, and `anchorFindings()` commits each to the provenance chain,
  minting a SHA-256 `AnchorReceipt` hash-linked to the prior entry. The findings, the
  exact hashed packets, and the receipts are baked into
  **`src/generated/engine-findings.json`** (committed, so an app-only deploy like Vercel
  ships the same engine-produced artifact without needing the siblings).
- The cockpit loads that file via the provenance seam (`src/lib/provenance.ts`) and
  **re-verifies every engine `packet_hash` in-browser** with WebCrypto (`src/lib/chain.ts`
  mirrors the provenance hash scheme byte-for-byte — proven: browser hashes ==
  engine `node:crypto` hashes). The green badge is an independent re-verification, not a
  re-assertion. Live corrections append as new linked entries on top of the engine chain.

```bash
npm run generate   # re-bake engine-findings.json from a live engine run (needs siblings built)
```

## Run

```bash
cd app
npm install
npm run dev        # → http://localhost:5173
npm run build      # prebuild (engine → bake findings) + tsc -b && vite build
npm run typecheck  # tsc --noEmit
npm run preview    # serve the production build
```

## Deploy

`app/vercel.json` pins the build: `framework: vite`, `installCommand: npm install`,
`buildCommand: npm run build`, `outputDirectory: dist`, and SPA `rewrites` so every
path routes to `index.html`. Set the Vercel project **Root Directory = `app/`** (the
committed `engine-findings.json` means the `prebuild` hook gracefully skips the
engine rebuild there and ships the baked artifact).

**One-command production deploy (run from `app/`):**

```bash
npx vercel deploy --prod
```

> This repo's session had **no `VERCEL_TOKEN`** in the environment, so no deploy was
> performed. With a token set, the same command deploys non-interactively:
> `npx vercel deploy --prod --token "$VERCEL_TOKEN" --yes`. Equivalently, from the repo
> root: **`./deploy.sh`** (clean build + `npx vercel deploy --prod app/`).

## Screens

Hero lives at `/`; the 6 cockpit screens live inside the shell (left nav).

| Route          | Screen                       | Data status |
|----------------|------------------------------|-------------|
| `/`            | Hero / landing               | placeholder copy (lane C drops visuals) |
| `/spend`       | Spend overview               | **real fixture** — per-vendor cost, reconciled monthly total; identified-savings headline = engine total |
| `/utilization` | Seat vs. activity            | **real fixture** — purchased vs. active-30d, recomputed utilization |
| `/findings`    | Findings (**HERO BEAT**)     | **REAL ENGINE OUTPUT** — engine-produced findings, each citing its source rows, showing its engine-minted SHA-256 anchor receipt (re-verified in-browser), a chain-integrity verify badge, and a Correct button that appends a real linked correction and live-re-renders the trail |
| `/agents`      | Agent registry               | stub (static rows; trustless-agents UI plugs in later) |
| `/agent-fit`   | Agent fit (**lane E**)       | **in-app data** — bounded swarm as a trustless registry, fit recommendation (agent ⋈ governance task), per-agent `AnchorReceipt`-style attestation badges |
| `/governance`  | Ratified-cap / governance    | stub cap + **real** chain verification via the seam |
| `/decisions`   | Decision log                 | **real** findings + persisted corrections from the chain |

## Agent fit / trustless agents (lane E)

`/agent-fit` (`src/screens/AgentFit.tsx`, data in `src/lib/agentFit.ts`) is the
trustless-agents surface: the bounded governance swarm (Analyst / SDR / Auditor /
Operator) rendered as a verifiable **agent registry**, a **fit recommendation**
matching each bounded agent to a governance task (by lane + scope overlap), and a
per-agent **trustless attestation badge** that mirrors the contract `AnchorReceipt`
proof (local-first by default, with an Algorand-testnet on-chain example).

> **Prior art.** The concept is **reused and restyled** from the public
> `algorand-berlin-2026` trustless-agents asset (agent registry + marketplace +
> on-chain attestation badges). It is **not** copied verbatim — it is adapted from
> a generic agent marketplace into this product's *bounded* governance swarm. All
> data is in-app and mirrors `src/lib/contract.ts` shapes (`AgentRead`,
> `AnchorReceipt`); a Phase-3 swap can back it with the live registry +
> `provenance/` attestations without touching the component.

## The provenance data-seam (the durable part)

`src/lib/provenance.ts` is the single seam every screen reads through. Stable API:

- `listProvenance()` / `loadProvenance(id)` → findings as `ProvenanceView` (finding + cited rows + `AnchorReceipt` + verify state)
- `submitCorrection(draft)` → appends a `Correction` (never mutates)
- `verifyChain()` → per-link hash-chain integrity report

Wire types live in `src/lib/contract.ts`, copied/adapted from the canonical
`coordination/contract.ts` at the repo root (`Packet` / `AgentRead` /
`AnchorReceipt` / `Correction` / `SpendLineItem` / `SeatActivity` /
`SavingsFinding`). Keep them in sync; coordinate before changing a type.

Findings are derived from `src/lib/fixtures.ts`, which loads the seeded CSVs from
`public/data/*.csv` (copied from repo-root `data/`), reconciles spend ⋈
seat-activity, and derives `SavingsFinding`s whose `monthly_savings` reconciles
to the report total. Those findings are wrapped as contract `Packet`s and fed
into the browser-native provenance chain below.

## Browser-native provenance chain (`src/lib/chain.ts`)

The provenance + correction loop runs **LIVE in the browser**. The canonical
provenance library (`../provenance/`) is Node-only — it links against
`better-sqlite3`, a native addon that **cannot run in a browser**. So `chain.ts`
is a browser-native re-implementation that mirrors that library's hash scheme
**EXACTLY**:

- `stableStringify` — sorted object keys at every level, arrays preserved in order.
- `canonicalPacketPayload` — schema-tagged (`liminal.provenance.v1`),
  anchor-fields-excluded, ordinal-sorted reads, optionals resolved to explicit `null`.
- SHA-256 over that canonical string → lowercase hex.

The **only** substantive difference from `provenance/src/hash.ts` is the digest
primitive: the canonical lib uses `node:crypto` `createHash("sha256")`; the
browser uses **WebCrypto** `crypto.subtle.digest("SHA-256", …)`. Both emit
identical bytes — so a packet hashed here produces the **same 64-char hex** as
`provenance/`'s `computePacketHash` would for the same packet. (Proven by a
golden-vector parity check: `node:crypto` and WebCrypto digests of the canonical
string of every derived finding packet match exactly.)

On top of the hash, `chain.ts` mirrors `provenance/src/log.ts` + `correct.ts`:

- an **append-only, hash-linked** event log (in-memory + `localStorage`-persisted
  instead of SQLite); each entry carries `packet_hash` + `prev_hash`.
- `anchorLocal` **receipts** (`anchor_chain: "local"`, `anchor_network:
  "local-first"`) — the on-chain Algorand path is server-side/env-gated and
  intentionally absent in the browser.
- **corrections as new linked entries that re-anchor**, never mutations
  (mirrors `correct()` — the correction carries `source_packet_id` +
  `user_correction` and links onto the chain tail).
- `verifyChain()` — re-hashes every stored payload (self-consistency) **and**
  checks every `prev_hash` against the prior entry's `packet_hash`. A single
  flipped byte breaks verification at that row.

The findings screen renders finding → cited source rows → SHA-256 anchor receipt
→ Correct. Clicking **Correct** appends a correction to the chain (persisted to
`localStorage`), and the correction trail + the chain-integrity verify badge
re-render live — the badge stays green because the new entry re-anchors cleanly.

### Phase-3 note — convergence with `provenance/`

Because `chain.ts` reproduces the canonical hash scheme byte-for-byte, the
browser chain and the Node `provenance/` library are **hash-consistent**: the
same packet yields the same id on both surfaces. Phase-3 swaps the in-browser
`localStorage` store for a thin server seam in front of `provenance/` (real
SQLite log + best-effort on-chain Algorand anchors) **without changing any
hashes or component code** — the four exported seam functions
(`listProvenance` / `loadProvenance` / `submitCorrection` / `verifyChain`) keep
their signatures, and the receipts/corrections already match `contract.ts`.

## Where design (lane C) plugs in

- `src/styles.css` — intentionally neutral; the real design system replaces it.
- `src/screens/Hero.tsx` — hero visuals.
- Per-screen markup is plain HTML/CSS classes so design can restyle without
  touching data wiring.

## Not-yet-here (owned by other lanes)

- S4 deliberation workflow (lane A) — feeds the Findings/Decision-log beats with live agent reads.
- Final visual design (lane C).
- Live Anthropic calls — out of scope for this skeleton; the seam is fixture-backed.

---

## Original stream spec (S3 + S5) — reference

> Preserved from the scaffold. The 6 screens above are the canonical lane-D set; the
> demo-narrative screens below (onboarding, OKR baseline, tray→slate, live deliberation)
> are lane-A / lane-C beats that layer on once those lanes land.

The operator cockpit shown in the demo. **DQ-critical:** all demoed UI must live here (public).
The private `liminal-desktop` (Tauri) internals stay home; what's demoed is built/extracted here.

Demo-narrative screens (lead with motion, not charts): Setup/Onboarding (swarm detects MCPs +
candidate streams) · OKR baseline · Tray → Slate · Deliberation + Finding · **Trustless Agents UI**
(reuse + restyle the public `algorand-berlin-2026` asset; note as prior art per `../CONTRIBUTIONS.md`)
· Ratify + Provenance trail + AI Spend Brief. Consumes design tokens from `liminal-prototype` and
the provenance lib in `../provenance/`. Full spec: private founder-brain
`ops/build-day/streams/S3_DESKTOP_DMG.md` + `S5_DESIGN_SYSTEM_UI.md`.
