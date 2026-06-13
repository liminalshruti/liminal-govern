#!/usr/bin/env node
/**
 * generate-findings.mjs — BUILD-TIME engine → cockpit bridge (Build Day 2026-06-13).
 *
 * The engine (`../engine`) is Node-only: analyze() recomputes seat utilization from the raw
 * `data/` fixtures into SavingsFinding[], and anchorFindings() commits each finding to the
 * local-first provenance chain (`../provenance`, better-sqlite3 + node:crypto) minting an
 * AnchorReceipt with a real SHA-256 packet_hash hash-linked to the previous entry.
 *
 * The cockpit (`app`) is a static browser bundle and cannot run better-sqlite3. So we wire the
 * two at BUILD TIME: this script runs the REAL engine, captures the findings, the exact packets
 * that were hashed, and the receipts, then bakes them into `src/generated/engine-findings.json`.
 * The cockpit loads THAT file and re-verifies every packet_hash in the browser with WebCrypto
 * (src/lib/chain.ts mirrors the provenance hash scheme byte-for-byte), then appends live
 * corrections on top of the engine's anchored chain.
 *
 * Determinism: anchorFindings is given a fixed `now`, so packets/hashes/receipts are
 * byte-identical every run → reproducible builds, stable diffs.
 *
 * Prereq (the app `prebuild` hook does this): build ../provenance and ../engine first.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  analyze,
  anchorFindings,
  findingToPacket,
  reconcileFindings,
} from "../../engine/dist/index.js";
import { hashOf } from "../../provenance/dist/src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/generated/engine-findings.json");

/** Fixed anchor instant → deterministic packets, hashes, and receipts across builds. */
const ANCHORED_AT = "2026-06-13T09:00:00.000Z";
const FIXTURE = process.env.ENGINE_FIXTURE ?? "q2-spend";

function fail(msg) {
  console.error(`\n  generate-findings: ${msg}\n`);
  process.exit(1);
}

async function main() {
  console.log(`\n  ▸ Running real engine analyze("${FIXTURE}")…`);
  const report = analyze(FIXTURE);

  console.log(`  ▸ Anchoring ${report.findings.length} findings to the provenance chain…`);
  const { log, receipts } = await anchorFindings(report.findings, { now: ANCHORED_AT });
  const verify = log.verifyChain();
  log.close();

  const reconcile = reconcileFindings(report.findings, report.monthly_savings_total);

  if (!verify.ok) {
    fail(`engine chain did not verify: ${verify.reason ?? "broken"} @${verify.brokenIndex}`);
  }
  if (!reconcile.ok) {
    fail(`reconcile failed: sum=$${reconcile.sum} vs total=$${reconcile.total} (±$${reconcile.tolerance})`);
  }

  const utilById = new Map(report.utilization.map((u) => [u.row_id, u]));

  const findings = report.findings.map((savings, i) => {
    // Reproduce the exact per-finding timestamp anchorFindings used, so the packet we emit
    // is byte-identical to the one the engine hashed (and re-hashes to the same receipt).
    const created_at = new Date(Date.parse(ANCHORED_AT) + i * 1000).toISOString();
    const packet = findingToPacket(savings, created_at);
    // anchorLocal stamps anchored_at with wall-clock; normalize to the deterministic anchor
    // instant so the baked artifact is byte-stable across builds (no spurious git churn).
    const receipt = { ...receipts[i], anchored_at: created_at };

    // PARITY GATE: the emitted packet must reproduce the engine's anchored hash, or the
    // cockpit could never re-verify it. Fail the build rather than ship a broken chain.
    const recomputed = hashOf(packet);
    if (recomputed !== receipt.packet_hash) {
      fail(`packet/receipt hash mismatch for ${savings.finding_id}: ${recomputed} != ${receipt.packet_hash}`);
    }

    const sourceRows = savings.source_row_ids
      .map((id) => utilById.get(id))
      .filter(Boolean)
      .map((u) => ({
        row_id: u.row_id,
        vendor: u.vendor,
        plan: u.plan ?? "",
        seats_purchased: u.seats_purchased,
        active_seats_30d: u.active_seats_30d,
        monthly_cost: u.monthly_cost,
        per_seat_cost: u.per_seat_cost,
        utilization_pct: u.utilization_pct,
      }));

    return { savings, packet, receipt, sourceRows };
  });

  const out = {
    _comment:
      "GENERATED at build time by app/scripts/generate-findings.mjs from the REAL engine (analyze + anchorFindings). Do not edit by hand — run `npm run generate` (or any `npm run build`) to refresh.",
    generated_at: new Date().toISOString(),
    fixture: report.fixture,
    generated_for: report.generated_for,
    rows_analyzed: report.rows_analyzed,
    monthly_savings_total: report.monthly_savings_total,
    reconcile,
    chain_verified: verify.ok,
    chain_length: verify.length,
    anchored_at: ANCHORED_AT,
    utilization: report.utilization,
    findings,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(
    `  ✓ Baked ${findings.length} engine findings + receipts → src/generated/engine-findings.json`,
  );
  console.log(
    `    $${report.monthly_savings_total}/mo reclaimable · reconcile OK · chain verified (${verify.length} entries)\n`,
  );
}

main().catch((err) => {
  fail(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
