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

## What M1 is NOT (next milestones)

M1 is the **deterministic** loop (the live Opus 4.8 adversarial reviewer is **M2**, mirroring how
govern's `spend-audit.mjs` encodes the same drop the live reviewer reaches). M2 also adds the
per-claim **ratification UI** (ratify/amend/drop/defer). M3 = seal & export fail-closed. M4 =
arbitrary-brief AI extraction + prior-Judgment re-entry. The unit is **a Judgment** throughout.
