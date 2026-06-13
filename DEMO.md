# Demo Runbook — Liminal AI Spend Governance

> Hero beats for the live demo, with **what to show** + **what to say** + a **fallback** per beat.
> Persona: **Maria**, an AI-transformation lead who gave her team Opus 4.8 with a real budget and a
> 60% product / 40% security mandate — and can't answer the board: *is the spend advancing the goals?*
> The one decision that proves the product: **"Opus 4.8 cannot be used for calendar management — use
> the verified CalendarOps Agent instead."**

## Pre-flight (do this before you present)

```bash
# 1 · build the provenance lib the engine + workflow anchor into
cd provenance && npm install && npm run build && cd ..
# 2 · generate the audit report (so the gate + cockpit have fresh data)
node .claude/workflows/spend-audit.mjs        # → out/report.json, prints the E14 catch
npm test                                       # → 12 pass (the rubric gate is green)
# 3 · cockpit up
cd app && npm install && npm run dev           # → http://localhost:5173
# 4 · keep a key exported for the live enforceCap beat
#     ANTHROPIC_API_KEY must be set (already in env); never echo it on screen
```
Have a second terminal in `engine/` ready (`npm install` done) for the live refusal beat.

---

## ⏱ 1-minute cut (the wedge → the catch → the refusal)

1. **`/try-liminal` in Claude Code** — three bounded agents read one brief and disagree; the in-lane
   one works, the others **refuse and name the right agent**. *"Governance starts in the tool they
   already use."*
2. **Cockpit `/findings`** — a finding cites its **source rows** and shows a **SHA-256 anchor receipt**
   with a green chain-integrity badge. *"Every claim is evidence, hash-linked — not a dashboard
   assertion."*
3. **The self-catch** — point at the audit output: *naïve $446 → verified $284*; **E14 was dropped**
   because PR-103 proves it's product engineering. *"The model refuted its own claim — and a test
   fails closed if that ever gets undone."*
4. **Live refusal** — in `engine/`, the bounded Opus agent **refuses an over-cap commit** and a
   surveillance request. *"It judges spend decisions, not people."*

---

## ⏱ 3-minute cut (numbered hero beats)

### Beat 1 — Install wedge: `/try-liminal`
- **Show:** run `/try-liminal` in Claude Code (or `node plugin/skills/try-liminal/run.js`). Three
  bounded `model: opus` agents read one brief; the in-lane agent acts, the others **REFUSE** and name
  the correct agent. Your one-line correction is captured as the record.
- **Say:** "The front door is the tool the team already lives in. Bounded agents that refuse
  out-of-lane are the whole safety model — and your correction becomes the first governed decision."
- **Fallback:** if the live call hiccups, run the **offline** suite — `node --test plugin/test/*.test.js`
  (5 pass) — it exercises the same bounded-deliberation + correction round-trip on a bundled fixture.

### Beat 2 — Cockpit: spend mapped to goals
- **Show:** `http://localhost:5173` → `/spend` and `/utilization`. Per-vendor cost and a reconciled
  monthly total; purchased seats vs. active-30d with **recomputed** utilization (not assumed).
- **Say:** "First we map AI usage to OKRs. Security is running **24% against a 40% target** —
  under-allocated. That's the board answer Maria couldn't give."

### Beat 3 — Agents deliberate and disagree
- **Show:** `/agent-fit` — the bounded governance swarm (Analyst / SDR / Auditor / Operator) as a
  trustless registry, each matched to a governance task with a per-agent attestation badge.
- **Say:** "Eight bounded agents deliberate over spend, OKR alignment, productivity, security, misuse,
  agent-fit, provenance, and exec-comms — each refusing out-of-lane. Disagreement is the feature."

### Beat 4 — Finding cites source rows + shows its provenance anchor  ★ HERO
- **Show:** `/findings` — open a finding. It expands to its **cited source rows**, its **SHA-256 anchor
  receipt** (`anchor_chain: "local"`), and a green **chain-integrity verify badge**.
- **Say:** "This is the product: a decision artifact with citations. Click it and you see the rows that
  produced the number and the hash that anchors it. Evidence, not assertion."

### Beat 5 — Self-verification: the model catches its own error  ★ JUDGES REWARD THIS
- **Show:** the workflow output (Beat 0 / pre-flight): `naive savings $446 → verified $284 (adversarial
  review dropped 1 claim)`, with `✗ F-E14 ... PR-103 proves E14 is product engineering`. Then show the
  guard test passing: `npm test` → *"counting the dropped E14 claim breaks reconciliation."*
- **Say:** "A naïve pass flagged E14 as $162 of calendar waste. A fresh adversarial reviewer checked
  the PR evidence, found PR-103 — it's actually shipped product engineering — and **dropped the claim**.
  $446 became $284. The model caught its own error, and the test makes sure it stays caught."
- **Fallback:** if anything is stale, just re-run `node .claude/workflows/spend-audit.mjs` live — it's
  deterministic and reprints the catch in under a second.

### Beat 6 — Operator corrects → re-anchored
- **Show:** on `/findings`, click **Correct** on a finding and add a note. The correction appends as a
  **new linked entry** (never a mutation); the correction trail and the verify badge **re-render live**
  — and the badge stays **green** because the new entry re-anchors cleanly.
- **Say:** "Corrections are first-class entries in the same chain as the things they correct. The
  correction loop *is* the product — and the chain stays verifiable through it."
- **Fallback:** the Node lib does the same headless — `cd provenance && npm run build` then
  `node --import tsx src/cli.ts correct find_figma "utilization recomputed at 35%"` → re-anchors.

### Beat 7 — `enforceCap` refuses an over-cap action  ★ LIVE OPUS
- **Show:** second terminal in `engine/` — `node --import tsx src/cli.ts enforce --cap 1500`. A bounded
  **`claude-opus-4-8`** agent rules on each decision:
  ```
  DEC-02 [$2400/mo] → REFUSE/over-cap        The $2400 commit exceeds the ratified $1500 cap…
  DEC-03 [$200/mo]  → REFUSE/surveillance    Per-employee monitoring is surveillance of people…
  ```
- **Say:** "Governance without surveillance: the live agent refuses an over-cap commit **and** refuses
  to monitor individual employees. And if the model ever approved something over-cap, a deterministic
  guard overrides it to a refusal. It judges spend, never people."
- **Fallback:** if the network is down, run `cd engine && npm test` — the offline cap-guard tests pass
  and the **LIVE** test self-skips, so the suite still goes green on stage.

---

## Closing line
"Eight bounded Opus agents, one adversarial reviewer that refutes weak claims, every finding anchored
to a tamper-evident chain, a cap agent that refuses — and the whole thing gates itself green against a
written rubric with no human in the loop. That's AI spend you can put in front of a board."

## Honest framing (don't over-claim)
- Provenance is **local-first**; the on-chain Algorand anchor is **env-gated** (`ANCHOR_URL`) and never
  blocks the chain — show the local receipt, mention on-chain as opt-in.
- Demand is **discovery, not closed pilots**.
- Prior art is **PPA-protected** (lead US Provisional **64/080,639**) and **not** in this repo —
  `provenance/` is a clean reimplementation. See `CONTRIBUTIONS.md`.
