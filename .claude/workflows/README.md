# .claude/workflows/ — Stream S4: the orchestration artifact

The saved dynamic workflow that builds-and-verifies the slice — the Orchestration-score artifact, and
the "model verified itself" proof.

**Build:** author with `ultracode` / "use a workflow", then `/workflows` → `s` → save here as
`spend-audit.js` (or `govern.js`). Phases:
1. **ingest** — parse the AI-usage fixture + OKR baseline (parallel).
2. **classify** — `OKR-alignment` + `Spend analyst` agents classify usage to objectives.
3. **deliberate** — 8 bounded agents (Spend analyst · OKR-alignment · Productivity-evidence ·
   Security-evidence · Misuse/policy · Agent-marketplace evaluator · Provenance · Exec-comms),
   `model: opus`.
4. **adversarial review** — a fresh Read-only reviewer refutes weak claims; unsupported ones drop.
5. **anchor** — surviving findings + the ratified decision → `../../provenance/` chain.
6. **verify** — run `../../rubric.md` + `../../tests/`; emit "done" only when all 5 checks pass.

Reads `args` = the fixture path → re-run on new data in one command (rerunnability). Full spec:
private founder-brain `ops/build-day/streams/S4_ORCHESTRATION_ARTIFACTS.md`.
