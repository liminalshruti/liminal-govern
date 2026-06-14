# Submission checklist — Claude Build Day (2026-06-13, 5pm)

> The final gate before submitting. Each item is a DQ-relevant requirement from the Build Day rules
> (public repo · only-today's-work clearly marked · README + rubric + session log · 1-min video ·
> live URL · all teammates added). Mark **✅ done** / **⏳ pending** and keep this honest — per the
> claim-veracity rule, do not mark an item done until it is verifiably true *right now*.

| # | Requirement | Status | Evidence / where |
|---|---|---|---|
| 1 | **Repo is public** | ✅ done | `liminalshruti/liminal-govern` is **public** (GitHub visibility: `public`, verified via API). |
| 2 | **All teammates added as collaborators** | ✅ done (GitHub) / ⏳ submission page | GitHub collaborators: `liminalshruti` (owner) + `allsmog` (Sean / Shayaun Nejad, **write**). Still add both on the Cerebral Valley submission page at submit. |
| 3 | **1-minute demo video recorded** | ✅ done | Linked in the README "Judges — start here": <https://drive.google.com/file/d/14uzy0KED-uJZSkYtRDZZY_n_5wo8OscK/view>. ⚠️ Confirm Drive sharing is **"Anyone with the link → Viewer"** (incognito test) so async judges can open it. |
| 4 | **README present** | ✅ done | `README.md` — problem, ICP, workflow (not a dashboard), demo run, "how done is verified". |
| 5 | **Rubric present** | ✅ done | `rubric.md` — 5 model-gradable "done" checks, each mapped to a test. |
| 6 | **Session log present** | ✅ done | `SESSION_LOG.md` — judge-readable transcript of a real `/spend-audit` run on Opus 4.8: bounded deliberation → the **live** adversarial reviewer refuting the E14 trap → deterministic core → the fail-closed gate. Honestly labels live (`out/live-adversarial-review.txt`, 4.4s, 1228 in / 358 out) vs. deterministic core. |
| 7 | **CONTRIBUTIONS (built-today vs prior art)** | ✅ done | `CONTRIBUTIONS.md` — pre-empts the DQ question; covers `provenance/`, `plugin/`, `engine/`, `app/`, `.claude/workflows/`, `data/`, `mcp/`, `managed/`. |
| 8 | **`npm test` green (the unified gate)** | ✅ done | Verified locally **5/5 suites green**: root (12) · plugin (14) · provenance (22) · engine (16: 15 pass + 1 live-Opus skip without `ANTHROPIC_API_KEY`) · app coherence (5) = **69 checks (68 pass + 1 skip)** via one `npm test`. CI runs the same on every push/PR — badge in the README. |
| 9 | **CI re-verifies on every push/PR** | ✅ done | `.github/workflows/ci.yml` runs `npm test` on push + PR — another team can rerun "done" tomorrow. |
| 10 | **Live URL responds** | ✅ done | **https://liminal-govern-cockpit.vercel.app** (200) — auto-deploys from `main` (Vercel root dir `app/`); serves the canonical cockpit ($4,500 Opus spend · $284 verified · E14 dropped via PR-103). |

## Remaining items
All hard gates are met (repo public ✔ · video recorded + linked ✔ · `npm test` green ✔ · live URL ✔).
Only two confirmations remain, both founder-owned and outside the code:
- **(3) Video sharing:** confirm the Drive link is **"Anyone with the link → Viewer"** (incognito test) so async judges can open it.
- **(2, partial) Submission page:** GitHub collaborators are set; still add both teammates on the Cerebral Valley submission form at submit.

> **Pre-submit gate (do not skip):** repo public ✔ · teammates ✔ · video ✔ · README + rubric +
> session log committed ✔ · `npm test` green (CI badge green) ✔ · live URL loads ✔.
