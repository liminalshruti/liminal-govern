#!/usr/bin/env node
/**
 * engine CLI.
 *
 *   engine analyze [fixture]     — recompute utilization, print findings + reconcile total
 *   engine anchor  [fixture]     — anchor findings to the provenance chain, verify it, print receipts
 *   engine enforce --cap <n>     — run the bounded Opus enforcement agent over decisions
 *
 * Fixtures: a known name ("q2-spend" | "sample-spend") or a path to a spend CSV.
 */

import { readFileSync } from "node:fs";
import { analyze } from "./analyze.js";
import { anchorFindings, reconcileFindings } from "./anchor.js";
import { enforceCap } from "./enforce.js";
import type { SpendDecision } from "./types.js";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const CHAIN_DB = ".engine-chain.db";

/** Default decision set for the enforce demo: in-lane/under-cap, over-cap, out-of-lane, surveillance. */
function defaultDecisions(): SpendDecision[] {
  return [
    { id: "DEC-01", description: "Rightsize Airtable to 7 active seats and drop 23 idle seats.", vendor: "Airtable", amount: 140, lane: "seat-rightsizing" },
    { id: "DEC-02", description: "Renew Vercel Enterprise at full 12 seats despite 4 active.", vendor: "Vercel", amount: 2400, lane: "renewal" },
    { id: "DEC-03", description: "Add per-employee keystroke monitoring to flag low Cursor usage by name.", vendor: "Cursor", amount: 200, lane: "monitoring" },
    { id: "DEC-04", description: "Approve a new $9k/mo enterprise BI contract to consolidate dashboards.", vendor: "NewBI", amount: 9000, lane: "new-vendor" },
  ];
}

async function cmdAnalyze(fixture?: string): Promise<void> {
  const report = analyze(fixture);
  const rec = reconcileFindings(report.findings, report.monthly_savings_total);
  console.log(`\n  AI Spend Brief — ${report.fixture} (${report.rows_analyzed} vendors)\n`);
  console.log("  Recomputed utilization (from raw 30-day active seats):");
  for (const u of report.utilization) {
    const tag = u.healthy ? "ok " : "LOW";
    console.log(
      `    [${tag}] ${u.row_id} ${u.vendor.padEnd(16)} ${String(u.active_seats_30d).padStart(3)}/${String(u.seats_purchased).padEnd(3)} seats  ${String(u.utilization_pct).padStart(5)}%  $${u.monthly_cost}/mo`,
    );
  }
  console.log(`\n  Findings (${report.findings.length}):`);
  for (const f of report.findings) {
    console.log(`    ${f.finding_id} [${f.source_row_ids.join(",")}] ${f.vendor} @ ${f.utilization_pct}% → save $${f.monthly_savings}/mo`);
    console.log(`        ${f.recommended_action}`);
  }
  console.log(`\n  Monthly savings total: $${report.monthly_savings_total}`);
  console.log(`  Reconcile (sum vs total, ±$${rec.tolerance}): ${rec.ok ? "OK" : "FAIL"} (sum=$${rec.sum}, delta=$${rec.delta})\n`);
}

async function cmdAnchor(fixture?: string): Promise<void> {
  const report = analyze(fixture);
  const { log, receipts } = await anchorFindings(report.findings, { dbPath: CHAIN_DB });
  const verify = log.verifyChain();
  const rec = reconcileFindings(report.findings, report.monthly_savings_total);
  console.log(`\n  Anchored ${receipts.length} findings to ${CHAIN_DB}\n`);
  for (const r of receipts) {
    console.log(`    ${r.packet_id}  hash=${r.packet_hash.slice(0, 16)}…  prev=${(r.prev_hash ?? "∅").slice(0, 12)}  [${r.anchor_chain}/${r.anchor_network}]`);
  }
  console.log(`\n  verifyChain(): ${verify.ok ? "OK" : `BROKEN @${verify.brokenIndex}: ${verify.reason}`} (length=${verify.length})`);
  console.log(`  reconcile(): ${rec.ok ? "OK" : "FAIL"} (sum=$${rec.sum} vs total=$${rec.total}, ±$${rec.tolerance})\n`);
  log.close();
}

async function cmdEnforce(args: string[]): Promise<void> {
  const capArg = flag(args, "--cap");
  if (!capArg) {
    console.error("engine enforce: --cap <n> is required");
    process.exit(2);
  }
  const cap = Number(capArg);
  const decisionsPath = flag(args, "--decisions");
  const decisions: SpendDecision[] = decisionsPath
    ? (JSON.parse(readFileSync(decisionsPath, "utf8")) as SpendDecision[])
    : defaultDecisions();

  console.log(`\n  Enforcement agent (${process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8"}) — ratified cap $${cap}/mo\n`);
  const verdicts = await enforceCap(cap, decisions);
  for (const v of verdicts) {
    const mark = v.verdict === "approve" ? "APPROVE" : `REFUSE/${v.refusal_kind}`;
    console.log(`    ${v.decision_id} [$${v.amount}/mo] → ${mark}  (${v.source})`);
    console.log(`        ${v.rationale}`);
  }
  const refusals = verdicts.filter((v) => v.verdict === "refuse").length;
  console.log(`\n  ${refusals}/${verdicts.length} refused.\n`);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "analyze":
      await cmdAnalyze(rest[0]);
      break;
    case "anchor":
      await cmdAnchor(rest[0]);
      break;
    case "enforce":
      await cmdEnforce(rest);
      break;
    default:
      console.log("usage: engine <analyze|anchor|enforce> [fixture] [--cap <n>] [--decisions <path>]");
      process.exit(cmd ? 2 : 0);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
