# `managed/` — the always-on governance daemon (scale beat)

A **Managed Agent** that runs the spend-audit governance workflow **on a schedule, server-side, async** —
the "this scales" answer to the on-demand MCP tool.

> **Status:** additive bonus / scale-narrative artifact. It does **not** need to run live for the demo — a
> working config (`agent.json`), a verifiable offline `--dry-run`, and this README are the deliverable. It
> reuses `../engine` + `../provenance`; it does not reimplement the audit, and it touches nothing outside
> `managed/`.

## The scale story: on-demand → scheduled → always-on

| Stage | Vehicle | Trigger | Where it runs |
|---|---|---|---|
| **On-demand** | `/spend-audit` MCP tool / dynamic workflow | a human asks | local Claude Code session |
| **Scheduled** | **this Managed Agent** (`agent.json`) | a weekly cron | managed cloud agent, async |
| **Always-on** | the same agent + event hooks (`on_misalignment → notify_operator`) | spend itself | continuous governance daemon |

The governance logic is identical at every stage — the same classification, the same adversarial refutation
of weak savings claims, the same provenance anchoring. What changes is **who pulls the trigger and where it
runs**. On-demand needs a human in the loop; the Managed Agent removes the human from the *schedule* (not from
the *decision* — findings are still ratified by an Operator). That is the difference between a tool you
*remember to run* and a daemon that *governs spend while you sleep*.

## What it does each run

1. Classifies every Opus 4.8 usage event in a team's fixture against the OKR baseline.
2. Detects OKR misalignment (here: security hardening **22%** of Opus spend vs a **40%** target).
3. Proposes agent-routing savings, then **adversarially refutes** any claim that PR evidence shows is real
   product engineering — and **drops it** (the $180 `calendar-sync` claim, backed by PR-103, is not counted).
4. **Anchors** the surviving findings + the ratified decision into the provenance chain (`../provenance`).
5. Emits the **AI Spend Brief** (`out/<team>-brief.md`) + the machine report (`out/<team>-report.json`).

Result on the bundled `acme-eng` fixture: **$3330 governed spend → $288 verified savings** (naive $468, one
claim refuted), provenance chain **VERIFIED** (6 entries).

## Layout

```
managed/
├── agent.json                  Managed Agent definition (Agent / Environment / Session / Events + schedule)
├── runner.mjs                  the session entrypoint — orchestrates the audit, renders the Brief
├── package.json                npm run dry-run | register
├── fixtures/acme-eng/          a team's weekly usage fixture (usage-events.csv + OKR/registry/PR siblings)
└── out/                        generated: <team>-report.json, <team>-brief.md, <team>-report.provenance.db
```

## Run it

**Verifiable offline (the gate path — no cloud, no API key):**

```bash
node managed/runner.mjs --dry-run --team acme-eng
# or: npm --prefix managed run dry-run
```

This builds `../provenance` once if needed (the agent's `environment.setup`), runs the real audit core
(`.claude/workflows/spend-audit.mjs`), anchors to the provenance chain, writes the Brief, and exits non-zero
if the chain does not verify (fail-closed). Deterministic: re-runs regenerate the report identically.

**Register on the cloud (prints the payload — does NOT make a live call):**

```bash
node managed/runner.mjs --register --team acme-eng
```

Prints the `POST /v1/agents` payload (with the `anthropic-beta: managed-agents-2026-04-01` header), the cron
schedule, and the caveats below. To actually register you would add `ANTHROPIC_API_KEY` + beta access and
send that payload; this artifact intentionally stops short of a live call.

**Audit a different team:** drop a `usage-events.csv` (+ `okr-baseline.json`, `agent-registry.json`,
`pr-evidence.csv`) under `managed/fixtures/<team>/` and run `--team <team>`, or point `--fixture` at any path.

## ZDR / Beta caveats (stated honestly)

- **Beta.** Managed Agents is a Beta capability and requires the `anthropic-beta: managed-agents-2026-04-01`
  header. The API surface can change; treat `agent.json` as illustrative of the model (Agent / Environment /
  Session / Events), not a frozen contract.
- **Not ZDR-eligible.** Managed Agents is **stateful** and is **not eligible for Zero-Data-Retention**. Don't
  feed it data that must be ZDR-covered. This audit operates on usage *metadata* (event id, category, cost) —
  no message content — and is governed under the team's standard data agreement.
- **Judges spend, not people.** The agent surfaces routing and OKR-allocation findings; it does not score or
  rank individuals. Per-person rows exist only to attribute spend to a workstream (and to *exonerate* — see
  PR-103, where an individual's "calendar" line is proven to be sanctioned product work and the claim against
  it is dropped).
- **Human stays on the decision.** The schedule is automated; ratification is not. Findings are anchored as
  proposals; the `effective` decision still carries `approved_by: Operator`.

## How this maps to the Managed Agents primitives

- **Agent** → `agent.json#agent` (name, model `claude-opus-4-8`, instructions, environment).
- **Environment** → `agent.json#agent.environment` (container + `setup` that builds `../provenance`).
- **Session** → one weekly run; `entrypoint` = `runner.mjs`, `inputs` = the team fixture, `outputs` = the
  Brief + report + provenance db.
- **Events** → `on_complete` emits the Brief and anchors findings; `on_misalignment` notifies the Operator;
  `on_chain_broken` fails closed. This is the hook set that turns a scheduled job into an always-on daemon.
