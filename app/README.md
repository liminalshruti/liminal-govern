# app/ — Liminal Govern cockpit (web)

The governance cockpit for **AI spend governance for founder/operators**. Web app
(Vite + React + TypeScript) so lane G can deploy it to Vercel. No Tauri.

> **Current state (build-day final).** The cockpit is **complete and live** at
> <https://liminal-govern-cockpit.vercel.app> — the converged-IA Agency shell, the dark
> "electric-data" theme, the Findings hero beat, ratification, and the trustless-agents
> surface, all live-wired to the **real provenance chain**. The sections below this one are
> **historical mid-build scaffold notes**, kept as a record of how it was assembled; where they
> say "skeleton", "stub", or "plugs in later", read them as the *starting point*, not the shipped
> state. For current truth, see the root [`README.md`](../README.md) and the live URL.

It grew from a deployable skeleton — app shell + routing, the cockpit screens, and the durable
**provenance data-seam** wired to the canonical contract + seeded fixtures — into the live cockpit above.

## Run

```bash
cd app
npm install
npm run dev        # → http://localhost:5173
npm run build      # tsc -b && vite build (clean build)
npm run typecheck  # tsc --noEmit
npm run preview    # serve the production build
```

Deploy (lane G): set the Vercel project root to `app/`. `vercel.json` already routes
all paths to `index.html` for client-side routing.

## Screens

Hero lives at `/`; the 6 cockpit screens live inside the shell (left nav).

| Route          | Screen                       | Data status |
|----------------|------------------------------|-------------|
| `/`            | Hero / landing               | placeholder copy (lane C drops visuals) |
| `/spend`       | Spend overview               | **real fixture** — per-vendor cost, reconciled monthly total |
| `/utilization` | Seat vs. activity            | **real fixture** — purchased vs. active-30d, recomputed utilization |
| `/findings`    | Findings (**HERO BEAT**)     | **real fixture** — each finding cites its source rows, shows its anchor receipt, has a Correct button, wired through the provenance seam |
| `/agents`      | Agent registry               | stub (static rows; trustless-agents UI plugs in later) |
| `/governance`  | Ratified-cap / governance    | stub cap + **real** chain verification via the seam |
| `/decisions`   | Decision log                 | **real** findings + in-session corrections from the seam |

## The provenance data-seam (the durable part)

`src/lib/provenance.ts` is the single seam every screen reads through. Stable API:

- `listProvenance()` / `loadProvenance(id)` → findings as `ProvenanceView` (finding + cited rows + `AnchorReceipt` + verify state)
- `submitCorrection(draft)` → appends a `Correction` (never mutates)
- `verifyChain()` → per-link hash-chain integrity report

Wire types live in `src/lib/contract.ts`, copied/adapted from the canonical
`coordination/contract.ts` at the repo root (`Packet` / `AgentRead` /
`AnchorReceipt` / `Correction` / `SpendLineItem` / `SeatActivity` /
`SavingsFinding`). Keep them in sync; coordinate before changing a type.

Today the seam is backed by `src/lib/fixtures.ts`, which loads the seeded CSVs
from `public/data/*.csv` (copied from repo-root `data/`), reconciles spend ⋈
seat-activity, and derives `SavingsFinding`s whose `monthly_savings` reconciles
to the report total.

### Phase-3 swap (one place)

The real provenance library lands on branch `build-day/s1-provenance` under
`../provenance/`. To wire it in, replace the **FIXTURE BACKEND** section of
`src/lib/provenance.ts` (`loadFindingPackets`, `mockAnchor`, the `submitCorrection`
body, `verifyChain`) with calls into `provenance/` — it already returns
`Packet` / `AnchorReceipt` / `Correction`. The four exported seam functions keep
their signatures, so **no component changes**.

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
