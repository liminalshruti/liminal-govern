#!/usr/bin/env node
// runner.mjs — the Managed Agent runner for the weekly AI-spend governance audit.
//
// The "scale" beat: the same spend-audit governance workflow that runs on-demand (the /spend-audit MCP
// tool) here runs on a SCHEDULE, server-side, async — a managed cloud agent (see agent.json, beta header
// managed-agents-2026-04-01). This runner is what that agent's session executes each week.
//
// It REUSES ../engine + ../provenance — it does not reimplement the audit. The deterministic audit core
// is .claude/workflows/spend-audit.mjs (which anchors into ../provenance); this runner orchestrates it on
// a team's usage fixture, then renders the AI Spend Brief from the result.
//
// Modes:
//   --dry-run            Execute the audit LOCALLY (no cloud). Verifiable offline + in the gate. [default]
//   --register           Print the Managed Agents cloud-registration payload + ZDR/beta caveats. Does NOT
//                        make a live API call (this is a scale-narrative artifact; see README).
//   --team <name>        Team whose fixture to audit (default from agent.json session.inputs.team).
//   --fixture <path>     Override the usage-events.csv path (relative to repo root).
//   --out <dir>          Output dir (relative to repo root; default managed/out).
//
// Usage:  node managed/runner.mjs --dry-run --team acme-eng

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, ".."); // repo root (managed/ → repo)
const AGENT_DEF = JSON.parse(readFileSync(join(HERE, "agent.json"), "utf8"));

// ── arg parsing ──────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const mode = has("--register") ? "register" : "dry-run"; // dry-run is the default + the verifiable path
const team = val("--team", AGENT_DEF.session.inputs.team);
const outDir = val("--out", "managed/out");

function resolveFixture() {
  const override = val("--fixture");
  if (override) return override;
  // a team maps to managed/fixtures/<team>/usage-events.csv; fall back to the agent.json default
  const byTeam = `managed/fixtures/${team}/usage-events.csv`;
  if (existsSync(resolve(ROOT, byTeam))) return byTeam;
  return AGENT_DEF.session.inputs.fixture;
}

// ── ensure the audit's one build-time dependency is present (REUSE, not reimplement) ───────────────
// The audit core imports ../provenance/dist; build it once if missing (mirrors test-all.mjs). This is
// the agent.json environment.setup step, run locally so --dry-run works fully offline.
function ensureProvenanceBuilt() {
  const dist = resolve(ROOT, "provenance", "dist", "src", "index.js");
  if (existsSync(dist)) return true;
  const provDir = resolve(ROOT, "provenance");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  process.stdout.write("  · building ../provenance once (dist/ missing)…\n");
  const installed =
    spawnSync(npm, ["ci"], { cwd: provDir, stdio: "inherit" }).status === 0 ||
    spawnSync(npm, ["install"], { cwd: provDir, stdio: "inherit" }).status === 0;
  if (!installed) return false;
  return spawnSync(npm, ["run", "build"], { cwd: provDir, stdio: "inherit" }).status === 0;
}

// ── render the AI Spend Brief (markdown) from the audit's report.json ──────────────────────────────
function renderBrief(report, { fixtureRel, runStamp }) {
  const m = report.misalignment;
  const surviving = report.findings.filter((f) => !f.dropped && f.type === "agent_fit_routing");
  const dropped = report.dropped_claims || [];
  const d = report.ratified_decision;
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const lines = [];
  lines.push(`# AI Spend Brief — ${AGENT_DEF.agent.display_name}`);
  lines.push("");
  lines.push(`> **Team:** ${report.okr_baseline.team ?? team} · **Period:** ${report.okr_baseline.budget_period} · **Source:** \`${fixtureRel}\``);
  lines.push(`> **Cadence:** ${AGENT_DEF.schedule.human} (\`${AGENT_DEF.schedule.cron}\`) · **Run:** ${runStamp} · **Mode:** scheduled Managed Agent (beta \`${AGENT_DEF.beta}\`)`);
  lines.push("");
  lines.push("## Headline");
  lines.push("");
  lines.push(`- **Governed Opus 4.8 spend:** $${m.opus_total_usd}/period across ${report.classified_usage.length} classified usage events.`);
  lines.push(`- **Verified recommended savings:** **$${report.total_recommended_savings}/period** (naive $${report.naive_savings} → adversarial review dropped ${dropped.length} claim${dropped.length === 1 ? "" : "s"}).`);
  lines.push(`- **OKR misalignment:** security hardening at **${pct(m.security_actual_pct)}** of Opus spend vs **${pct(m.security_target_pct)}** target (Δ ${pct(m.delta_pct)} under-allocated).`);
  lines.push(`- **Provenance:** chain ${report.provenance.chain_verified ? "**VERIFIED**" : "**BROKEN**"} (${report.provenance.chain_length} anchored entries).`);
  lines.push("");
  lines.push("## Verified savings findings");
  lines.push("");
  if (surviving.length) {
    lines.push("| Finding | Category | Action | Savings |");
    lines.push("|---|---|---|---|");
    for (const f of surviving) {
      lines.push(`| ${f.finding_id} | ${f.category} | ${f.recommended_action} | $${f.monthly_savings}/period |`);
    }
  } else {
    lines.push("_No routing savings survived review this period._");
  }
  lines.push("");
  lines.push("## Dropped by adversarial review (evidence, not assertion)");
  lines.push("");
  if (dropped.length) {
    for (const c of dropped) lines.push(`- **${c.finding_id}** — ${c.drop_reason}`);
  } else {
    lines.push("_No claims refuted this period._");
  }
  lines.push("");
  lines.push("## Ratified decision");
  lines.push("");
  lines.push(`> ${d.decision}`);
  lines.push("");
  lines.push(`**Rationale.** ${d.rationale}`);
  lines.push("");
  lines.push(`**Approved alternative:** ${d.approved_alternative} · **Approved by:** ${d.approved_by} · **Effective:** ${d.effective_period}`);
  lines.push("");
  lines.push("## Citations");
  lines.push("");
  for (const c of report.report_citations) lines.push(`- \`${c}\``);
  lines.push("");
  lines.push("---");
  lines.push(`_Generated by the ${AGENT_DEF.agent.name} Managed Agent. Judges spend, not people. Deterministic: re-runs regenerate identically. ${AGENT_DEF.data_handling.zdr_eligible ? "" : "ZDR-ineligible (Managed Agents Beta)."}_`);
  return lines.join("\n") + "\n";
}

// ── cloud registration payload (what `--register` would POST; we do NOT call live) ─────────────────
function registrationPayload(fixtureRel) {
  return {
    _headers: { "anthropic-beta": AGENT_DEF.beta },
    _endpoint: "POST https://api.anthropic.com/v1/agents",
    agent: {
      name: AGENT_DEF.agent.name,
      model: AGENT_DEF.agent.model,
      instructions: AGENT_DEF.agent.instructions,
      environment: AGENT_DEF.agent.environment,
    },
    schedule: AGENT_DEF.schedule,
    session: { ...AGENT_DEF.session, inputs: { ...AGENT_DEF.session.inputs, fixture: fixtureRel } },
    events: AGENT_DEF.events,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────
const fixtureRel = resolveFixture();

process.stdout.write(`\n  Managed Agent: ${AGENT_DEF.agent.name} (${AGENT_DEF.agent.model})\n`);
process.stdout.write(`  Cadence: ${AGENT_DEF.schedule.human}  ·  Mode: ${mode.toUpperCase()}  ·  Team: ${team}\n\n`);

if (mode === "register") {
  const payload = registrationPayload(fixtureRel);
  process.stdout.write("  Cloud registration payload (NOT sent — scale-narrative artifact):\n\n");
  process.stdout.write(JSON.stringify(payload, null, 2).replace(/^/gm, "    ") + "\n\n");
  process.stdout.write("  Caveats (stated honestly):\n");
  process.stdout.write(`    · Beta header required: ${AGENT_DEF.beta}\n`);
  process.stdout.write(`    · ZDR-eligible: ${AGENT_DEF.data_handling.zdr_eligible} — ${AGENT_DEF.data_handling.note}\n`);
  process.stdout.write("    · Requires ANTHROPIC_API_KEY + Managed Agents beta access. This runner does NOT make a live call.\n");
  process.stdout.write("    · The scheduled session runs exactly: " + AGENT_DEF.session.entrypoint + "\n\n");
  process.exit(0);
}

// dry-run: execute the audit locally and emit the brief.
if (!ensureProvenanceBuilt()) {
  process.stderr.write("  ✗ could not build ../provenance (needs network once for deps). Aborting.\n");
  process.exit(1);
}

mkdirSync(resolve(ROOT, outDir), { recursive: true });
const reportRel = join(outDir, `${team}-report.json`);
const reportAbs = resolve(ROOT, reportRel);

process.stdout.write(`  Running spend-audit over ${fixtureRel} (reuses ../provenance) …\n\n`);
const audit = spawnSync(
  process.execPath,
  [resolve(ROOT, ".claude/workflows/spend-audit.mjs"), fixtureRel, reportRel],
  { cwd: ROOT, stdio: "inherit" },
);
if (audit.status !== 0) {
  process.stderr.write("\n  ✗ spend-audit failed.\n");
  process.exit(audit.status || 1);
}

const report = JSON.parse(readFileSync(reportAbs, "utf8"));
const stamp = `${report.okr_baseline.budget_period}-13 (deterministic)`;
const brief = renderBrief(report, { fixtureRel, runStamp: stamp });
const briefRel = join(outDir, `${team}-brief.md`);
writeFileSync(resolve(ROOT, briefRel), brief);

// governance result + fail-closed gate
const ok = report.provenance.chain_verified === true && Array.isArray(report.findings) && report.findings.length > 0;
process.stdout.write("\n  ── Governance result ──\n");
process.stdout.write(`    Opus 4.8 spend:        $${report.misalignment.opus_total_usd}\n`);
process.stdout.write(`    Verified savings:      $${report.total_recommended_savings} (naive $${report.naive_savings})\n`);
process.stdout.write(`    Dropped by review:     ${report.dropped_claims.length} claim(s)\n`);
process.stdout.write(`    Provenance chain:      ${report.provenance.chain_verified ? "VERIFIED" : "BROKEN"} (${report.provenance.chain_length} entries)\n`);
process.stdout.write(`    Ratified decision:     ${report.ratified_decision.decision}\n`);
process.stdout.write(`\n    → report: ${reportRel}\n    → brief:  ${briefRel}\n`);
process.stdout.write(`\n  ${ok ? "✅ governance result produced (chain verified)" : "✗ gate failed"}\n\n`);
process.exit(ok ? 0 : 1);
