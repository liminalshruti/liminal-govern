# Brief Gate — M1

The commercial wedge of Liminal, v1: **a claim-to-Judgment gate around AI-generated executive briefs.**

> *Liminal makes AI-generated claims earn the right to become operational.*
> Before an AI-generated business claim becomes operational, Liminal forces it through correction
> and ratification — and stores the trusted version.

Implements `founder-brain/liminal-ip/03-architecture/SPEC_BRIEF_GATE_V1_2026-06-15.md` § **M1**
(*"vault + the self-catch runs on a brief"*). Built on the proven liminal-govern provenance chain +
adversarial-review pattern — the same loop the Build Day submission shipped, generalized from the
fixed spend fixture to an **arbitrary brief**.

## Run it

```bash
npm run brief-gate          # extract → adversarial-drop → anchor surviving Judgments → report
npm run test:brief-gate     # the M1 acceptance tests (fail-closed proof)
```

## What M1 proves (the self-catch + the boundary)

Given an AI-generated brief whose claim #2 ("$162/mo wasted on calendar work") is **contradicted by
evidence** (PR-103 proves the calendar-sync work is real product engineering):

```
extracted 4 claims
adversarial review dropped 1: ✓ self-catch
  ✗ C2: Refuted — PR-103 proves the calendar-sync work is product engineering, not waste.
3 surviving claims → Judgments anchored to the chain
provenance chain: VERIFIED
```

- **The self-catch:** the gate surfaces the claims, an adversarial reviewer catches the weak one
  against evidence, and **drops it** — before any human acts on it.
- **THE BOUNDARY (system law):** a dropped claim has **no Judgment** and is **never anchored** → it
  cannot enter the trusted record → it cannot become operational. Enforced in control flow
  (`if (state !== "survived") continue`), proven by the test *"the dropped claim is NOT in the
  anchored Judgments."*

## Files

| File | What |
|---|---|
| `brief-gate.mjs` | the M1 core: ingest → extract → adversarial-drop → anchor surviving Judgments → report |
| `data/sample-brief.md` | a synthetic AI-generated AI-ROI brief (one claim is contradicted) |
| `data/evidence.json` | the contradicting evidence (PR-103) the reviewer cross-checks |
| `tests/m1.test.mjs` | 6 acceptance tests incl. the fail-closed boundary |
| `out/` | generated (gitignored): the provenance db + `report.json` |

## M2 — the live adversarial reviewer (done)

The reviewer is now a **pluggable seam** (`reviewer.mjs`): **live Opus 4.8 for the demo,
deterministic mock for the tests.**

```bash
npm run brief-gate                         # deterministic (no key) OR live if ANTHROPIC_API_KEY is set
ANTHROPIC_API_KEY=sk-... npm run brief-gate # LIVE: real Opus 4.8 adversarial reviewer (forced-tool verdict)
BRIEF_GATE_REVIEWER=mock npm run brief-gate # force deterministic
```

**The M2 invariant (the load-bearing guarantee):** the reviewer changes *how* the survives/drops
decision is made — **never whether the fail-closed boundary holds.** Both reviewers return the same
verdict shape `{ survives, refuted_by?, reason }`; the gate's boundary code consumes it identically.
A dropped claim still produces **no Judgment → no anchor → no export**, regardless of which reviewer
ran (or whether the live model errors — it **fails closed**: an unreviewable claim is dropped, never
silently passed). Proven by `tests/m2-reviewer.test.mjs` ("a dropped claim is never a Judgment —
regardless of WHY" + "FAIL CLOSED"). The acceptance test runs the **deterministic** reviewer, so it
passes with **no live model round-trip** (`npm run test:brief-gate`).

The AI is a pluggable input to a deterministic boundary — not the boundary itself. A wrong model
produces a wrong survives/drops *call*, never a *broken boundary*.

## M3 — ratification + seal/export, fail-closed (done)

The surviving (corrected) Judgments are still only **draft**. M3 adds **per-claim ratification**
(`ratify` / `amend` / `drop` / `defer`) and the **seal** step. Dispositions come from
`data/dispositions.json` (what the ratification UI will produce — the UI is a later milestone; M3
proves the seal logic + the gate).

```bash
npm run brief-gate   # → correction (M1/M2) → ratification (M3) → SEALED, exportable Ratified Brief
```

**The M3 boundary (the wedge completed):** survived-review is **not enough** to export. A
**Ratified Brief** is exportable **only if every Judgment is ratify/amend/defer** — a **pending**
(un-ratified) Judgment **blocks export entirely**. So a claim must survive **both** gates —
*correction* (M1/M2: adversarial review) **and** *ratification* (M3: a human decides) — to become
operational. That is "correction **and** ratification" in code. Proven by `tests/m3-seal.test.mjs`
("FAIL CLOSED: a pending Judgment blocks export").

`amend` is **append-only** — it records `from → to` and preserves the original (the correction
stream, never a silent overwrite).

## M4 — arbitrary-brief extraction + prior-Judgment re-entry (done)

Two seams that generalize the wedge and make the vault **compound**:

- **Extraction seam** (`extractor.mjs`): **live Opus 4.8** for free-form briefs / **deterministic
  parser** for the tests (same pattern as the reviewer). The parser returns 0 claims on free-form
  prose — *that is why the live extractor exists* (it reads arbitrary briefs); the deterministic
  path keeps the tests model-free.
- **Re-entry** (`vault.mjs`): sealed Judgments persist across briefs. A new brief's claims **re-enter**
  Judgments ratified in a **prior** brief — *"this was ruled on last month."* Only **exportable**
  (fully-ratified) briefs enter the vault (the boundary again: nothing un-ratified compounds).

```bash
# the vault compounds across briefs:
node brief-gate/brief-gate.mjs brief-gate/data/sample-brief.md         # June → seals → vault
node brief-gate/brief-gate.mjs brief-gate/data/sample-brief-july.md \
     brief-gate/data/evidence.json brief-gate/out/report-july.json "" brief-gate/out/vault.json
#   ↩ re-entry: C1 references a prior Judgment (C3 from sample-brief.md, amend)
```

This is "the system remembers what survived correction" (the moat) at M4 grade. Proven by
`tests/m4-extract-reentry.test.mjs`.

## The complete wedge — what runs today

`extract → adversarial-drop → anchor → ratify → seal → vault → re-enter`, with fail-closed
boundaries at **correction** (M1/M2) and **ratification** (M3). The unit is **a Judgment**; the
artifact is a **Ratified Brief**; the vault **compounds** (M4). **27 tests** across the four
milestones; govern's existing suite unaffected.

**Still ahead (not milestones — the surface + live paths):** the ratification **UI** (the visual
ratify/amend/drop/defer surface — built when the surface-host, govern cockpit vs. liminal-desktop,
is decided); and running the **live** Opus 4.8 extractor + reviewer (needs `@anthropic-ai/sdk` at
the govern root + `ANTHROPIC_API_KEY` — the seams + boundaries are tested, the live calls are one
`npm i` away).
