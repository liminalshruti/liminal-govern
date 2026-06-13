# data/ — AI-usage governance fixture (synthetic; the primary demo dataset)

Fully synthetic. Maria's narrow engineer cohort with early access to **Opus 4.8**; goal split **60%
product / 40% security hardening**. This fixture is shaped so the S4 workflow produces a real,
quantified finding — including an **adversarial-verifier trap** (the "Claude caught its own error"
beat). Files: `usage-events.csv` · `okr-baseline.json` · `agent-registry.json` · `pr-evidence.csv` ·
`security-tickets.csv` · `prior-decisions.json`. (The `*-spend.csv`/`seat-activity.csv` are legacy
SaaS-seat fixtures — secondary, repurposable for an ROI side-angle only.)

## The numbers (Opus 4.8 spend this period = $4,500)
| Category | $ | % | vs OKR |
|---|---|---|---|
| product_dev | 2,520 | 56% | target 60% |
| security_hardening | 1,080 | 24% | **target 40% — UNDER-allocated (finding)** |
| calendar_admin (E12,E13,**E14**) | 360 | 8% | misaligned-looking |
| summarization (E15,E16) | 135 | 3% | misaligned-looking |
| unclassified (E17–E19) | 405 | 9% | needs classification |

Misaligned-looking = calendar + summarization = **$495 (11%)**. Haiku usage (E20,E21, $14) = already-good cheap usage.

## The findings the workflow should produce
1. **Misuse / agent-fit:** ~11% of Opus spend ($495) is calendar/admin + generic summarization → route
   to cheaper **verified** internal agents (CalendarOps for calendar, DigestBot for summarization).
   Naive realizable savings ≈ **$446/mo** (calendar $324 + summarization $122).
2. **OKR misalignment:** security hardening **24% vs the 40% target** → reallocate.
3. **Agent-fit (the trustless-registry beat):** CalendarOps Agent (registry-verified, ~10% of Opus
   cost) should handle calendar work → ratify the policy *"Opus 4.8 cannot be used for calendar
   management — use CalendarOps."*

## 🪤 The adversarial-verifier trap (the hero "model caught its own error" beat)
**E14** ($180) is labeled `calendar_admin`, so a naive misuse pass flags it as routable waste (+$162
savings). But **PR-103 (Priya, "calendar-sync feature: Google Calendar API + UI") proves E14 is
product work**, not admin. The adversarial reviewer cross-checks `pr-evidence.csv`, **refutes the
$162 claim, and drops it.**
- Naive savings: **$446** → Verified realizable savings: **$284/mo** (calendar $162 + summarization
  $122). The model dropped a **$162** false claim.
- Secondary insight once corrected: true product spend = $2,700 = **exactly the 60% target**; true
  waste is **7%**, not 11%; security is still under-allocated. Honesty + the verification loop, live.

## Reconciliation (for `rubric.md` / `tests/`)
The report's **total recommended savings ($284)** must reconcile to the sum of the *surviving* findings
(calendar $162 + summarization $122 = $284) **±$1** — the dropped E14 claim must NOT be counted. Tests
fail closed if it is.
