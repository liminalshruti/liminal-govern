import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/analyze.js";
import { anchorFindings, reconcileFindings, findingToPacket } from "../src/anchor.js";
import { ProvenanceLog } from "../src/provenance.js";

const NOW = "2026-06-13T00:00:00.000Z";

test("anchorFindings writes a hash-linked chain that verifies", async () => {
  const report = analyze("q2-spend");
  const { log, receipts } = await anchorFindings(report.findings, { now: NOW });
  assert.equal(receipts.length, report.findings.length);
  const verify = log.verifyChain();
  assert.ok(verify.ok, `chain broke: ${verify.reason}`);
  assert.equal(verify.length, report.findings.length);
  // First link has no predecessor; the rest chain to the prior hash.
  assert.equal(receipts[0]!.prev_hash, null);
  for (let i = 1; i < receipts.length; i++) {
    assert.equal(receipts[i]!.prev_hash, receipts[i - 1]!.packet_hash);
  }
  log.close();
});

test("each receipt is a local-first anchor citing its finding", async () => {
  const report = analyze("q2-spend");
  const { log, receipts } = await anchorFindings(report.findings, { now: NOW });
  for (let i = 0; i < receipts.length; i++) {
    assert.equal(receipts[i]!.packet_id, report.findings[i]!.finding_id);
    assert.equal(receipts[i]!.anchor_chain, "local");
    assert.match(receipts[i]!.packet_hash, /^[0-9a-f]{64}$/);
  }
  log.close();
});

test("tampering with a stored finding breaks verifyChain", async () => {
  const report = analyze("q2-spend");
  const log = new ProvenanceLog(":memory:");
  await anchorFindings(report.findings, { log, now: NOW });
  assert.ok(log.verifyChain().ok);
  // Corrupt one stored payload directly in the DB to simulate tampering.
  (log as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } }).db
    .prepare("UPDATE events SET payload_json = REPLACE(payload_json, 'Vercel', 'Heroku')")
    .run();
  const verify = log.verifyChain();
  assert.equal(verify.ok, false, "tampering must break the chain");
  log.close();
});

test("findingToPacket carries the cited evidence in context", () => {
  const report = analyze("q2-spend");
  const f = report.findings[0]!;
  const pkt = findingToPacket(f, NOW);
  assert.equal(pkt.kind, "finding");
  const ctx = JSON.parse(pkt.context) as { source_row_ids: string[]; monthly_savings: number };
  assert.deepEqual(ctx.source_row_ids, f.source_row_ids);
  assert.equal(ctx.monthly_savings, f.monthly_savings);
});

test("reconcileFindings holds for the anchored report", () => {
  const report = analyze("q2-spend");
  const rec = reconcileFindings(report.findings, report.monthly_savings_total);
  assert.ok(rec.ok);
});
