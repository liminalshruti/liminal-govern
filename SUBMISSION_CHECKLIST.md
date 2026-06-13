# Submission checklist — Claude Build Day (2026-06-13, 5pm)

> The final gate before submitting. Each item is a DQ-relevant requirement from the Build Day rules
> (public repo · only-today's-work clearly marked · README + rubric + session log · 1-min video ·
> live URL · all teammates added). Mark **✅ done** / **⏳ pending** and keep this honest — per the
> claim-veracity rule, do not mark an item done until it is verifiably true *right now*.

| # | Requirement | Status | Evidence / where |
|---|---|---|---|
| 1 | **Repo is public** | ⏳ pending | `liminalshruti/liminal-govern` — flip to public before 5pm (was private per HACK_EVALUATION). |
| 2 | **All teammates added as collaborators** | ⏳ pending | Add every build-day contributor on GitHub → Settings → Collaborators. |
| 3 | **1-minute demo video recorded** | ⏳ pending | Record the hero spine (setup → finding → adversarial catch → ratify → provenance → brief); the video is also the demo-risk fallback. |
| 4 | **README present** | ✅ done | `README.md` — problem, ICP, workflow (not a dashboard), demo run, "how done is verified". |
| 5 | **Rubric present** | ✅ done | `rubric.md` — 5 model-gradable "done" checks, each mapped to a test. |
| 6 | **Session log present** | ⏳ pending | Capture the Opus 4.8 unattended verification-loop session log and commit it (judges score the log). |
| 7 | **CONTRIBUTIONS (built-today vs prior art)** | ✅ done | `CONTRIBUTIONS.md` — pre-empts the DQ question; covers `provenance/`, `plugin/`, `engine/`, `app/`, `.claude/workflows/`, `data/`. |
| 8 | **`npm test` green (the unified gate)** | ✅ done (CI) / ⏳ confirm locally | Root + plugin verified green locally (17 checks); provenance (18 checks) runs in CI where the registry is reachable. Green = all 3 suites pass via `npm test`. See the CI badge in the README. |
| 9 | **CI re-verifies on every push/PR** | ✅ done | `.github/workflows/ci.yml` runs `npm test` on push + PR — another team can rerun "done" tomorrow. |
| 10 | **Live URL responds** | ⏳ pending | Deploy the cockpit (`./deploy.sh`) → paste the URL into the README `LIVE_DEMO_URL` placeholder and confirm it loads. Owned by the deploy/app lane. |

## How to clear the pending items
- **(1) Public:** GitHub → repo → Settings → Danger Zone → Change visibility → Public.
- **(2) Teammates:** Settings → Collaborators and teams → add each contributor.
- **(3) Video:** screen-record the 3-min hero spine; trim to ≤60s; keep the full take as fallback.
- **(6) Session log:** export the Claude Code session transcript (the unattended verify loop where
  Opus 4.8 catches the E14 calendar-sync trap and re-runs the rubric) and commit it at repo root.
- **(8) Confirm green:** `npm test` from the repo root (needs network once to install
  `provenance/` deps; CI does this automatically). Expect all 3 suites green.
- **(10) Live URL:** `./deploy.sh` (Vercel; set `VERCEL_TOKEN` for non-interactive), then update the
  README placeholder and load the URL to confirm it responds.

> **Pre-submit gate (do not skip):** repo public ✔ · teammates ✔ · video ✔ · README + rubric +
> session log committed ✔ · `npm test` green (CI badge green) ✔ · live URL loads ✔.
