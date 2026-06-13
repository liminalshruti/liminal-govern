#!/usr/bin/env node
// spend-audit.mjs — the deterministic core of the /spend-audit dynamic workflow.
//
// Reads the AI-usage governance fixture, classifies every Opus-4.8 usage event against the OKR
// baseline, detects misalignment (security under its 40% target), proposes agent-routing findings,
// runs an ADVERSARIAL cross-check that refutes weak claims against PR evidence (the E14 calendar-sync
// trap → dropped via PR-103), ANCHORS the surviving findings + the ratified decision into the real
// provenance chain (../../provenance), and emits out/report.json in the exact shape tests/report.test.js
// asserts. Fully deterministic: no wall-clock in the report, so re-runs regenerate it identically.
//
// Usage:  node .claude/workflows/spend-audit.mjs [data/usage-events.csv] [out/report.json]
//         The fixture's sibling files (okr-baseline.json, agent-registry.json, pr-evidence.csv) are
//         read from the fixture's own directory, so a second dataset lives in its own subdir
//         (e.g. data/q3/) and reruns there without touching the primary gate report.
// Lane:   S4 orchestration. Touches .claude/workflows/, out/. Consumes provenance/ (built dist).

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";
import {
  ProvenanceLog,
  anchorLocal,
} from "../../provenance/dist/src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", ".."); // repo root (.claude/workflows → repo)

// ── tiny zero-dep CSV (fixture has no embedded commas) ───────────────────────────────────────────
function parseCsv(path) {
  const text = readFileSync(path, "utf8").trim();
  const [head, ...rows] = text.split(/\r?\n/);
  const cols = head.split(",");
  return rows.filter(Boolean).map((line) => {
    const cells = line.split(",");
    const o = {};
    cols.forEach((c, i) => (o[c] = cells[i]));
    return o;
  });
}
const round = (n) => Math.round(n);

// ── 1 · ingest ───────────────────────────────────────────────────────────────────────────────────
const fixtureArg = process.argv[2] || "data/usage-events.csv";
const outArg = process.argv[3] || "out/report.json"; // override to rerun on new data without clobbering the gate
const usagePath = resolve(ROOT, fixtureArg);
const DATA = dirname(usagePath); // sibling fixture files live next to usage-events.csv
if (!existsSync(usagePath)) {
  console.error(`spend-audit: fixture not found: ${usagePath}`);
  process.exit(2);
}
const loadJson = (name) => JSON.parse(readFileSync(join(DATA, name), "utf8"));

const usage = parseCsv(usagePath).map((r) => ({ ...r, est_cost_usd: Number(r.est_cost_usd) }));
const okr = loadJson("okr-baseline.json");
const agents = loadJson("agent-registry.json");
const prs = parseCsv(join(DATA, "pr-evidence.csv"));

const GOVERNED_MODEL = okr.approved_model; // claude-opus-4-8

// category → objective map, derived from the baseline (not assumed)
const categoryToObjective = {};
for (const o of okr.objectives) {
  for (const cat of o.aligned_task_categories || []) categoryToObjective[cat] = o.id;
}
// which categories are routable to a cheaper verified agent (the misuse classes)
const ROUTABLE = {
  calendar_admin: { agent: "calendarops", agentName: "CalendarOps Agent", saveFactor: 0.9 },
  summarization: { agent: "digestbot", agentName: "DigestBot", saveFactor: 0.9 },
};
const prByEvent = new Map(prs.map((p) => [p.linked_usage_event, p]));

// ── 2 · classify every usage event against the OKRs (no silent drops) ────────────────────────────
const classified_usage = usage.map((e) => ({
  event_id: e.event_id,
  model: e.model,
  category: e.task_category,
  objective_id: categoryToObjective[e.task_category] ?? null,
  est_cost_usd: e.est_cost_usd,
  source_row: `usage-events.csv#${e.event_id}`,
}));

// ── 3 · spend rollup (governed model only) + misalignment ────────────────────────────────────────
const opus = usage.filter((e) => e.model === GOVERNED_MODEL);
const opusTotal = opus.reduce((a, e) => a + e.est_cost_usd, 0);
const spendByCat = {};
for (const e of opus) spendByCat[e.task_category] = (spendByCat[e.task_category] || 0) + e.est_cost_usd;

const securityActual = (spendByCat["security_hardening"] || 0) / opusTotal;
const securityObjective = okr.objectives.find((o) =>
  (o.aligned_task_categories || []).includes("security_hardening"),
);
const securityTarget = securityObjective ? securityObjective.allocation : 0.4;
const misalignment = {
  security_actual_pct: Number(securityActual.toFixed(4)), // 1080/4500 = 0.24
  security_target_pct: securityTarget, // 0.40
  delta_pct: Number((securityTarget - securityActual).toFixed(4)),
  governed_model: GOVERNED_MODEL,
  opus_total_usd: opusTotal,
};

// ── 4 · raw findings → ADVERSARIAL review (refute weak claims vs PR evidence) ─────────────────────
// One agent-routing finding per (routable category × event), so the reviewer can drop a single event
// (E14) without nuking the whole category. Calendar splits into E12,E13 (survive) and E14 (dropped).
const rawFindings = [];
for (const e of opus) {
  const route = ROUTABLE[e.task_category];
  if (!route) continue;
  rawFindings.push({
    finding_id: `F-${e.event_id}`,
    type: "agent_fit_routing",
    category: e.task_category,
    employee: e.employee,
    recommended_action: `Route "${e.task_label}" to the registry-verified ${route.agentName} (~10% of Opus cost).`,
    approved_alternative: route.agentName,
    approved_alternative_id: route.agent,
    monthly_savings: round(e.est_cost_usd * route.saveFactor),
    source_row_ids: [e.event_id],
  });
}

// Adversarial reviewer: a routing claim is REFUTED if PR evidence shows the work is real product
// engineering on the approved track (not admin). E14 ("calendar-sync feature") is backed by PR-103
// (Priya, product) → the $162 claim is dropped, not counted.
for (const f of rawFindings) {
  const eid = f.source_row_ids[0];
  const pr = prByEvent.get(eid);
  if (pr && pr.workstream === "product") {
    f.dropped = true;
    f.drop_reason =
      `Refuted by adversarial review: ${pr.pr_id} (${pr.employee}, "${pr.title}") proves ${eid} is product engineering on the approved track, not ${f.category}. The $${f.monthly_savings} routing claim is dropped.`;
  }
}

// OKR-misalignment finding (no savings; surfaces the reallocation, cites the security rows)
const securityRowIds = opus.filter((e) => e.task_category === "security_hardening").map((e) => e.event_id);
const misalignmentFinding = {
  finding_id: "F-OKR-SECURITY",
  type: "okr_misalignment",
  recommended_action: `Reallocate Opus 4.8 spend toward security hardening: ${(securityActual * 100).toFixed(0)}% actual vs ${(securityTarget * 100).toFixed(0)}% target.`,
  monthly_savings: 0,
  source_row_ids: securityRowIds,
};

const findings = [...rawFindings, misalignmentFinding];
const surviving = findings.filter((f) => !f.dropped);
const total_recommended_savings = surviving.reduce((a, f) => a + (Number(f.monthly_savings) || 0), 0);

// ── 5 · ratified decision (the one policy that proves the product) ───────────────────────────────
const ratified_decision = {
  decision: "Opus 4.8 cannot be used for calendar management or routine admin work.",
  rationale:
    "Calendar/admin usage does not map to the approved OKRs, and a registry-verified lower-cost agent (CalendarOps, ~10% of Opus cost) covers it. Note: the calendar-sync work in E14 is product engineering (PR-103) and is explicitly NOT reclassified as admin.",
  approved_alternative: "CalendarOps Agent",
  approved_by: "Operator",
  effective_period: okr.budget_period,
  referenced_context: [
    "usage-events.csv",
    "okr-baseline.json",
    "agent-registry.json",
    "pr-evidence.csv#PR-103",
  ],
  agent_policy: {
    opus_4_8_allowed_for: agents.agents.find((a) => a.id === "opus-4-8")?.approved_for ?? [
      "product_dev",
      "security_hardening",
      "architecture_review",
    ],
    opus_4_8_disallowed_for: ["calendar_management", "routine_admin", "generic_summarization"],
  },
};

// ── 6 · anchor surviving findings + the ratified decision into the provenance chain ──────────────
// Fixed created_at (no wall-clock) → deterministic packet hashes → re-runs reconcile identically.
const STAMP = `${okr.budget_period}-13T00:00:00.000Z`; // 2026-06-13T00:00:00.000Z
const reportPath = resolve(ROOT, outArg);
const OUT = dirname(reportPath);
mkdirSync(OUT, { recursive: true });
const DB = join(OUT, basename(reportPath, ".json") + ".provenance.db");
for (const ext of ["", "-wal", "-shm"]) {
  try { rmSync(DB + ext, { force: true }); } catch {}
}
const log = new ProvenanceLog(DB);

function anchorPacket(id, kind, context, reads) {
  const packet = { id, kind: "finding", context, reads, created_at: STAMP };
  const ev = log.append({ id, kind: "packet", packet_id: id, packet, reads });
  const receipt = anchorLocal(ev.packet_hash, ev.prev_hash);
  receipt.packet_id = id;
  log.saveReceipt(receipt);
  return { packet_id: id, packet_hash: ev.packet_hash, prev_hash: ev.prev_hash,
           anchor_chain: receipt.anchor_chain, anchor_network: receipt.anchor_network };
}

const anchored = [];
for (const f of surviving) {
  anchored.push(
    anchorPacket(f.finding_id, "finding", f.recommended_action, [
      { agent_name: "Provenance", archetype: "ledger", quoted: f.recommended_action,
        situation: `savings $${f.monthly_savings}`, hidden_risk: "", next_move: "ratify",
        ordinal: 0 },
    ]),
  );
}
// the ratified decision itself is anchored as a policy packet
anchored.push(
  anchorPacket("D-RATIFY-CAL", "finding", ratified_decision.decision, [
    { agent_name: "Exec-comms", archetype: "decision", quoted: ratified_decision.decision,
      situation: ratified_decision.rationale, hidden_risk: "", next_move: "enforce", ordinal: 0 },
  ]),
);
const chain = log.verifyChain();
log.close();

// ── report.json (deterministic; the shape tests/report.test.js asserts) ──────────────────────────
const report_citations = [
  ...surviving.flatMap((f) => f.source_row_ids.map((id) => `usage-events.csv#${id}`)),
  "pr-evidence.csv#PR-103",
  "okr-baseline.json#" + (securityObjective?.id ?? "O2"),
  "agent-registry.json#calendarops",
];

const report = {
  generated_for: basename(usagePath),
  okr_baseline: okr,
  classified_usage,
  misalignment,
  findings,
  ratified_decision,
  total_recommended_savings,
  naive_savings: rawFindings.reduce((a, f) => a + (Number(f.monthly_savings) || 0), 0),
  dropped_claims: findings.filter((f) => f.dropped).map((f) => ({ finding_id: f.finding_id, drop_reason: f.drop_reason })),
  provenance: {
    chain_verified: chain.ok,
    chain_length: chain.length,
    anchored,
    db: "out/" + basename(DB),
  },
  report_citations,
};

writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

// ── human summary (the "model caught its own error" beat, on the CLI) ────────────────────────────
const dropped = findings.filter((f) => f.dropped);
console.log(`spend-audit: ${basename(usagePath)}`);
console.log(`  classified ${classified_usage.length} usage events; Opus 4.8 spend $${opusTotal}`);
console.log(`  security ${(securityActual * 100).toFixed(0)}% vs ${(securityTarget * 100).toFixed(0)}% target → under-allocated`);
console.log(`  naive savings $${report.naive_savings} → verified $${total_recommended_savings} (adversarial review dropped ${dropped.length} claim[s])`);
for (const d of dropped) console.log(`    ✗ ${d.finding_id}: ${d.drop_reason}`);
console.log(`  provenance chain: ${chain.ok ? "VERIFIED" : "BROKEN"} (${chain.length} entries) → out/${basename(DB)}`);
console.log(`  → ${outArg}`);
