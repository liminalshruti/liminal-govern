#!/usr/bin/env node
/**
 * generate-findings.mjs — BUILD-TIME bridge: S4 AI-spend report → cockpit (Build Day 2026-06-13).
 *
 * D1 COHERENCE FIX: the cockpit must tell the PITCH's story — AI-spend governance over Opus 4.8
 * ($4,500/mo, $284 verified savings, E14 DROPPED via PR-103, CalendarOps agent-fit, security 24%
 * vs 40%) — NOT the legacy SaaS-seat utilization audit. So the source of truth is the S4
 * orchestration output `out/report.json` (the 8-agent deliberation + adversarial reviewer), not
 * `engine.analyze(q2-spend)`.
 *
 * The cockpit is a static browser bundle and cannot run better-sqlite3. So we wire at BUILD TIME:
 * read the S4 report's findings (surviving + the dropped E14) + the ratified decision, wrap each as
 * a `kind:"finding"` Packet, ANCHOR the surviving findings + the ratified decision to the REAL
 * local-first provenance chain (`../provenance`, better-sqlite3 + node:crypto) minting real SHA-256
 * AnchorReceipts hash-linked in order, then bake everything into `src/generated/engine-findings.json`.
 * The browser re-verifies every packet_hash with WebCrypto (src/lib/chain.ts mirrors the hash scheme
 * byte-for-byte) and appends live corrections on top of the anchored chain.
 *
 * Determinism: fixed `anchored_at` → byte-identical packets/hashes/receipts across builds.
 *
 * Prereq (the app `prebuild` hook does this): build ../provenance first.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  ProvenanceLog,
  ingestPacket,
  reconcile,
  hashOf,
} from "../../provenance/dist/src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const REPO = resolve(APP, "..");
const OUT = resolve(APP, "src/generated/engine-findings.json");
const REPORT = resolve(REPO, "out/report.json");
const USAGE = resolve(REPO, "data/usage-events.csv");

/** Fixed anchor instant → deterministic packets, hashes, and receipts across builds. */
const ANCHORED_AT = "2026-06-13T09:00:00.000Z";
const stampAt = (i) => new Date(Date.parse(ANCHORED_AT) + i * 1000).toISOString();

function fail(msg) {
  console.error(`\n  generate-findings: ${msg}\n`);
  process.exit(1);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    header.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

/** Wrap an S4 finding as a finding-Packet whose context carries its cited evidence. */
function findingPacket(f, created_at) {
  return {
    id: f.finding_id,
    kind: "finding",
    context: JSON.stringify({
      finding_id: f.finding_id,
      type: f.type,
      category: f.category ?? null,
      source_row_ids: f.source_row_ids,
      monthly_savings: f.monthly_savings,
      approved_alternative: f.approved_alternative ?? null,
    }),
    reads: [
      {
        agent_name: "spend-auditor",
        archetype: "auditor",
        quoted: f.recommended_action,
        situation:
          f.type === "okr_misalignment"
            ? "Opus 4.8 spend mix vs the ratified OKR allocation"
            : `${f.category} on Opus 4.8 — a verified lower-cost agent covers this lane`,
        hidden_risk:
          "Frontier spend on work a cheaper verified agent could do compounds every month.",
        next_move: f.recommended_action,
        ordinal: 0,
      },
    ],
    created_at,
  };
}

/** Wrap the ratified decision as a finding-Packet that points back at the calendar finding. */
function decisionPacket(d, created_at) {
  return {
    id: "D-RATIFY-CAL",
    kind: "finding",
    context: JSON.stringify({
      decision: d.decision,
      approved_alternative: d.approved_alternative,
      agent_policy: d.agent_policy,
      referenced_context: d.referenced_context,
    }),
    reads: [
      {
        agent_name: "Operator",
        archetype: "operations",
        quoted: d.decision,
        situation: "Verified agent-fit finding ratified into enforced policy.",
        hidden_risk: "None — the rule is enforced at routing time going forward.",
        next_move: `Route calendar work to ${d.approved_alternative}; block Opus 4.8 for calendar_admin.`,
        ordinal: 0,
      },
    ],
    source_packet_id: "F-E12",
    user_correction: d.decision,
    correction_kind: "outer",
    created_at,
  };
}

async function main() {
  console.log(`\n  ▸ Baking cockpit findings from the S4 AI-spend report (out/report.json)…`);
  const report = JSON.parse(readFileSync(REPORT, "utf8"));
  const eventsById = new Map(parseCsv(readFileSync(USAGE, "utf8")).map((e) => [e.event_id, e]));

  const surviving = report.findings.filter((f) => !f.dropped);
  const dropped = report.findings.filter((f) => f.dropped);

  // Anchor surviving findings (in report order) + the ratified decision to the REAL chain.
  const log = new ProvenanceLog(":memory:");
  const anchoredPackets = [
    ...surviving.map((f, i) => findingPacket(f, stampAt(i))),
    decisionPacket(report.ratified_decision, stampAt(surviving.length)),
  ];
  const receipts = [];
  for (const packet of anchoredPackets) {
    const { receipt } = await ingestPacket(log, packet);
    receipts.push({ ...receipt, anchored_at: packet.created_at });
  }
  const verify = log.verifyChain();
  log.close();
  if (!verify.ok) fail(`engine chain did not verify: ${verify.reason ?? "broken"} @${verify.brokenIndex}`);

  // Parity gate: each emitted packet must re-hash to its anchored receipt, or the cockpit
  // could never re-verify it in-browser.
  anchoredPackets.forEach((packet, i) => {
    const recomputed = hashOf(packet);
    if (recomputed !== receipts[i].packet_hash) {
      fail(`packet/receipt hash mismatch for ${packet.id}: ${recomputed} != ${receipts[i].packet_hash}`);
    }
  });

  const receiptById = new Map(anchoredPackets.map((p, i) => [p.id, receipts[i]]));

  const sourceEventsFor = (ids) =>
    ids
      .map((id) => eventsById.get(id))
      .filter(Boolean)
      .map((e) => ({
        event_id: e.event_id,
        date: e.date,
        employee: e.employee,
        task_label: e.task_label,
        task_category: e.task_category,
        est_cost_usd: Number(e.est_cost_usd),
      }));

  // The cockpit finding view: surviving (anchored) findings first, then the dropped E14 (refuted).
  const buildFinding = (f, anchored) => {
    const packet = anchored
      ? anchoredPackets.find((p) => p.id === f.finding_id)
      : findingPacket(f, stampAt(999));
    const subject =
      f.type === "okr_misalignment"
        ? "Security hardening (OKR O2)"
        : `${f.category} · ${f.employee ?? ""}`.trim();
    return {
      savings: {
        finding_id: f.finding_id,
        source_row_ids: f.source_row_ids,
        vendor: subject,
        utilization_pct: 0, // not a seat-utilization audit; kept for shape compat, unused in UI
        recommended_action: f.recommended_action,
        monthly_savings: f.monthly_savings,
      },
      type: f.type,
      category: f.category ?? null,
      employee: f.employee ?? null,
      approved_alternative: f.approved_alternative ?? null,
      approved_alternative_id: f.approved_alternative_id ?? null,
      dropped: Boolean(f.dropped),
      drop_reason: f.drop_reason ?? null,
      packet,
      receipt: anchored ? receiptById.get(f.finding_id) : null,
      sourceEvents: sourceEventsFor(f.source_row_ids),
    };
  };

  const findings = [
    ...surviving.map((f) => buildFinding(f, true)),
    ...dropped.map((f) => buildFinding(f, false)),
  ];

  // Reconcile: surviving findings must sum to the report total (E14 not counted).
  const recon = reconcile(
    surviving.map((f) => ({ monthly_savings: f.monthly_savings })),
    report.total_recommended_savings,
  );
  if (!recon.ok) fail(`reconcile failed: sum=$${recon.sum} vs total=$${recon.total}`);

  // Category spend mix (Opus 4.8 by task category) for the spend / OKR screens.
  const catTotals = new Map();
  for (const u of report.classified_usage) {
    catTotals.set(u.category, (catTotals.get(u.category) ?? 0) + u.est_cost_usd);
  }
  const opusTotal = report.misalignment.opus_total_usd;
  const categorySpend = [...catTotals.entries()]
    .map(([category, usd]) => ({ category, usd, pct: Math.round((usd / opusTotal) * 1000) / 10 }))
    .sort((a, b) => b.usd - a.usd);

  const out = {
    _comment:
      "GENERATED at build time by app/scripts/generate-findings.mjs from the S4 AI-spend report (out/report.json), anchored to the REAL provenance chain. Do not edit by hand — run `npm run generate`.",
    generated_at: new Date().toISOString(),
    fixture: "usage-events",
    dataset: "ai-usage-governance",
    generated_for: report.okr_baseline.budget_period + " · Opus 4.8 AI-usage governance",
    governed_model: report.misalignment.governed_model,
    opus_total: opusTotal,
    rows_analyzed: report.classified_usage.length,
    naive_savings: report.naive_savings,
    monthly_savings_total: report.total_recommended_savings, // verified
    dropped_total: report.naive_savings - report.total_recommended_savings,
    reconcile: recon,
    chain_verified: verify.ok,
    chain_length: verify.length,
    anchored_at: ANCHORED_AT,
    okr: {
      security_actual_pct: report.misalignment.security_actual_pct,
      security_target_pct: report.misalignment.security_target_pct,
      objectives: report.okr_baseline.objectives.map((o) => ({
        id: o.id,
        name: o.name,
        target_pct: o.allocation,
        categories: o.aligned_task_categories,
      })),
    },
    category_spend: categorySpend,
    ratified_decision: {
      ...report.ratified_decision,
      packet_id: "D-RATIFY-CAL",
      packet: anchoredPackets.find((p) => p.id === "D-RATIFY-CAL"),
      receipt: receiptById.get("D-RATIFY-CAL"),
    },
    findings,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`  ✓ Baked ${findings.length} findings (${surviving.length} anchored + ${dropped.length} dropped) → src/generated/engine-findings.json`);
  console.log(`    naive $${report.naive_savings} → verified $${report.total_recommended_savings}/mo · reconcile OK · chain verified (${verify.length} entries)\n`);
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
