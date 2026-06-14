# Session Log — `/spend-audit` (S4 Orchestration)

> **Submission artifact.** A judge-readable transcript of an actual run of the AI Spend Governance
> workflow, captured on **2026-06-13**, **Claude Opus 4.8** (`claude-opus-4-8`). It shows the full
> arc the rubric grades: **direction → bounded deliberation → the model catching its own error →
> the fail-closed gate → verified numbers.** Every number and quote below is copied from real run
> output (`out/`), not narrated from memory.
>
> Pairs with `BRIEF.md` (the problem), `rubric.md` (the 5 model-gradable "done" checks), and
> `ORCHESTRATION.md` (how the repo was built by parallel Opus 4.8 agents).

---

## 0 · The direction (the brief Claude was handed)

Persona **Maria** — an AI-transformation/engineering lead with budget authority — gave a cohort of
engineers early access to **Claude Opus 4.8** with a real credit budget and a **60% product /
40% security-hardening** mandate. The board question she must answer **without surveilling her
people**: *is the spend advancing the goals, or being burned on work a cheaper agent should do?*

The workflow's contract is four parts (`ORCHESTRATION.md`): **Brief → Rubric → saved workflow →
tests/gate.** The agent does not decide it is done; the rubric does. "Done" is machine-checkable, so
the model can verify its own work with **no human in the verification loop**.

Command given to the workflow:

```
/spend-audit on data/usage-events.csv
```

The saved dynamic workflow (`.claude/workflows/spend-audit.js`) runs five phases — **Ingest →
Deliberate (8 bounded `model: opus` agents) → Adversarial review → Emit + anchor → Verify** — and a
deterministic core (`.claude/workflows/spend-audit.mjs`) makes the emitted report byte-reproducible.

---

## 1 · The data Claude was reasoning over (`data/usage-events.csv`)

21 usage events. The governed model is `claude-opus-4-8` (per `data/okr-baseline.json`). The trap is
hand-wired into the fixture: **E14 is *labeled* `calendar_admin`** but is titled a *"calendar-sync
feature: Google Calendar API integration + UI"* — and **PR-103 (Priya, workstream `product`) links
to E14**. A naïve misuse pass will mis-flag it as routable admin waste.

| event | who | category | label | $ |
|---|---|---|---|---|
| E12 | Elif | calendar_admin | Schedule team offsite + calendar wrangling | 90 |
| E13 | Bianca | calendar_admin | Reformat meeting notes + send calendar invites | 90 |
| **E14** | **Priya** | **calendar_admin (mislabel)** | **calendar-sync feature: Google Calendar API + UI** | **180** |
| E15 | Arjun | summarization | Summarize 40-page vendor PDF | 75 |
| E16 | Diego | summarization | Summarize Slack threads into weekly digest | 60 |

`data/pr-evidence.csv`: `PR-103,2026-06-05,Priya,calendar-sync feature (Google Calendar API + UI),product,E14`

---

## 2 · Bounded deliberation — 8 `model: opus` agents, each refusing out-of-lane

Phase 3 of the workflow fans out **8 bounded spend-governance agents in parallel**, each `model: opus`
and each instructed: *"Stay strictly within your lane; if a question is out of your lane, say
`REFUSE: not my lane → <which agent owns it>`."* (`.claude/workflows/spend-audit.js`, lines 50–70):

| Agent | Lane |
|---|---|
| Spend analyst | roll Opus 4.8 spend by category; name non-core spend |
| OKR-alignment | actual vs the 60/40 target; flag under-allocation |
| Productivity-evidence | cross-ref product spend with PR evidence |
| Security-evidence | is security under its 40% mandate? |
| Misuse/policy | flag spend with no approved OKR category → propose routing (**does NOT verify — that's the reviewer's job**) |
| Agent-marketplace evaluator | find registry-verified cheaper agents (CalendarOps, DigestBot) |
| Provenance | state exactly what must be anchored; refuse to invent numbers |
| Exec-comms | draft the one-line ratified policy |

The Misuse/policy agent is deliberately **naïve and eager**: it flags every `calendar_admin` and
`summarization` event — **including E14** — as routable waste. Naïve recommended savings: **$446**.
The verification of those claims is *not* its job; it is the adversarial reviewer's.

---

## 3 · The marquee beat — Claude (Opus 4.8) catches its own error (LIVE)

Phase 3.5 spins up a **fresh, skeptical Read-only adversarial reviewer** (`model: opus`) whose sole
job is to **refute** weak savings claims against PR evidence. This is the self-verification beat the
rubric is built around.

**This was run live against `claude-opus-4-8` using the API key in the environment** — the reviewer
prompt and forced-tool schema mirror phase 3.5 of `spend-audit.js`. Captured verbatim in
`out/live-adversarial-review.txt`:

```
LIVE adversarial reviewer — model: claude-opus-4-8
latency_ms: 4369 | usage: {"input_tokens":1228, ... "output_tokens":358 ...}
stop_reason: tool_use

verdict (forced record_verdict tool call):
{
  "verdicts": [
    { "event_id": "E12", "claim_survives": true,
      "reason": "No PR evidence on the product workstream backs this event. 'Schedule team
                 offsite + calendar wrangling' is genuine calendar admin work ... claim survives." },
    { "event_id": "E13", "claim_survives": true,
      "reason": "No PR evidence backs this event ... administrative scheduling work ... claim survives." },
    { "event_id": "E14", "claim_survives": false,
      "reason": "Refuted: PR-103 links directly to E14 (linked_usage_event=E14) on the authoritative
                 workstream=product. This is real product engineering (Google Calendar API
                 integration + UI), not admin. Per rule, the routing/savings claim must be dropped." }
  ],
  "dropped_event_ids": ["E14"]
}
```

**The model caught its own error.** Given the same evidence the naïve pass had, a fresh Opus 4.8
reviewer **independently refuted the E14 claim** — citing PR-103 and the authoritative
`workstream=product` column — while correctly **letting E12 and E13 survive** (genuine admin, no PR).
It refused to over-correct. **Naïve $446 → verified $284.**

This is not a story we tell; it's a **test that fails closed** (`tests/reconcile.test.js`): the gate
asserts *both* "surviving findings reconcile to $284 ±$1" **and** "counting the dropped E14 claim
breaks reconciliation." If any agent ever re-counts the refuted claim, the gate goes red.

---

## 4 · Emit + anchor — the deterministic core run (LIVE)

The deterministic core applies that same drop (E14 via PR-103), classifies every event, anchors the
surviving findings + the ratified decision into the **local-first** provenance chain, and writes
`out/report.json`. Captured verbatim in `out/run-stdout.txt`:

```
$ node .claude/workflows/spend-audit.mjs
spend-audit: usage-events.csv
  classified 21 usage events; Opus 4.8 spend $4500
  security 24% vs 40% target → under-allocated
  naive savings $446 → verified $284 (adversarial review dropped 1 claim[s])
    ✗ F-E14: Refuted by adversarial review: PR-103 (Priya, "calendar-sync feature (Google Calendar
      API + UI)") proves E14 is product engineering on the approved track, not calendar_admin. The
      $162 routing claim is dropped.
  provenance chain: VERIFIED (6 entries) → out/report.provenance.db
  → out/report.json
```

**Surviving findings reconcile to exactly $284** (`out/report.json`):

| finding | route to | monthly saving |
|---|---|---|
| F-E12 | CalendarOps Agent | $81 |
| F-E13 | CalendarOps Agent | $81 |
| F-E15 | DigestBot | $68 |
| F-E16 | DigestBot | $54 |
| **total** | | **$284** |

F-E14's $162 is **excluded** (dropped). F-OKR-SECURITY carries $0 savings — it surfaces the
**24% vs 40%** under-allocation, not a routing cut.

**Ratified decision** (anchored as a policy packet):
> *"Opus 4.8 cannot be used for calendar management or routine admin work."* — approved alternative
> **CalendarOps Agent**. Rationale explicitly notes *"the calendar-sync work in E14 is product
> engineering (PR-103) and is explicitly NOT reclassified as admin."*

**Provenance:** `chain_verified: true`, **6 entries** (F-E12, F-E13, F-E15, F-E16, F-OKR-SECURITY,
D-RATIFY-CAL), `anchor_network: local-first`. The chain is hash-linked and verifies.

---

## 5 · The fail-closed gate — `npm test` (the rubric, enforced)

The workflow only emits "done" when the model-graded gate is green. Captured verbatim in
`out/gate-stdout.txt`:

```
✔ Opus 4.8 spend totals $4,500
✔ security hardening is under-allocated vs the 40% OKR target
✔ the adversarial-verifier trap is wired: E14 is labeled calendar but PR-103 proves it's product
✔ surviving findings reconcile to $284 ±$1
✔ counting the dropped E14 claim breaks reconciliation (the trap must be excluded)
✔ the E14 trap finding is identifiable + must be dropped
✔ S4 report satisfies the 5 rubric checks
ℹ tests 12
ℹ pass 12
ℹ fail 0
ℹ skipped 0
```

**12 pass · 0 fail · 0 skip** — the five `rubric.md` checks hold (this is the **S4 root rubric gate**,
`node --test tests/*.test.js`; the repo-wide unified gate is **69 checks across 5 suites** — see the root
`README.md`). Green tests are the agent's stop condition.

---

## 6 · Self-verification of *this* log — byte-identical re-run

Re-running the core regenerates `out/report.json` **byte-for-byte** (no wall-clock in the report →
deterministic packet hashes). This is the rerunnability claim, verified:

```
hash run1: df39ec164f97e0ecb63b2806c00637046cd9de722233ed2fb4987d97553c5d51
hash run2: df39ec164f97e0ecb63b2806c00637046cd9de722233ed2fb4987d97553c5d51
DETERMINISTIC: byte-identical ✓
```

---

## 7 · Reproduce it — exact commands

```bash
# from the liminal-govern repo root (Node 20+):

# 1 · build the local-first provenance lib the core anchors into
npm --prefix provenance install && npm --prefix provenance run build

# 2 · run the deterministic core → emits out/report.json + a VERIFIED provenance chain
node .claude/workflows/spend-audit.mjs
#   ↳ classified 21 events · Opus 4.8 spend $4500 · security 24% vs 40%
#   ↳ naive $446 → verified $284 (E14 dropped via PR-103) · chain VERIFIED (6 entries)

# 3 · the model-graded gate (the rubric, enforced) — must be 12 pass / 0 fail / 0 skip
node --test tests/*.test.js

# rerun on a fresh dataset in one command (proves it's not memorized):
node .claude/workflows/spend-audit.mjs data/q3/usage-events.csv out/q3-report.json
```

The full dynamic workflow the judges score is `.claude/workflows/spend-audit.js`, invoked in Claude
Code as `/spend-audit on data/usage-events.csv` (its 8 deliberation agents + the adversarial reviewer
run `model: opus`).

---

## 8 · What was live vs. deterministic in this capture (honest labeling)

- **LIVE Opus 4.8** (`claude-opus-4-8`, API key from env): the **adversarial reviewer** call in §3 —
  a real model independently refuting the E14 claim (`out/live-adversarial-review.txt`,
  4.4s, 1228 in / 358 out tokens, `stop_reason: tool_use`).
- **Deterministic core** (`spend-audit.mjs`): the classify → drop → anchor → emit in §4–§6
  (`out/run-stdout.txt`, `out/report.json`) and the gate in §5 (`out/gate-stdout.txt`). The core
  encodes the *same* E14-via-PR-103 drop the live reviewer reached, which is why the gate's $284
  reconciliation is reproducible byte-for-byte.
- The **full** `spend-audit.js` (8 parallel `model: opus` deliberation agents) executes inside Claude
  Code's `/workflows` runtime, not via plain `node`; its phase-3.5 reviewer is the call reproduced
  live above. The deterministic core is the reliable, byte-reproducible substitute for the emit/gate
  path, clearly labeled as such.

## 9 · Honest scope (no over-claiming)

- Provenance is **local-first by default** (`anchor_network: local-first`); the on-chain Algorand path
  is env-gated (`ANCHOR_URL`) and never blocks the chain.
- Demand is **discovery, not closed pilots.**
- Prior art (the private Liminal provenance / bounded-agent patterns) is **PPA-protected — lead US
  Provisional 64/080,639** — and its source is **not** in this repo; `provenance/` is a clean
  reimplementation. See `CONTRIBUTIONS.md`.
- The model is **Claude Opus 4.8** (`claude-opus-4-8`).
- Governance judges **the agents' work and the spend, never the people** — every verdict above rules
  on a finding/claim, not on an employee.
