import assert from "node:assert/strict";
import { test } from "node:test";
import { correct, ingestPacket, reconcile } from "../src/correct.js";
import { ProvenanceLog } from "../src/log.js";
import type { Packet, SavingsFinding } from "../src/types.js";

function mkPacket(id: string): Packet {
  return {
    id,
    kind: "finding",
    context: `finding ${id}`,
    reads: [
      {
        agent_name: "auditor",
        archetype: "dissent",
        quoted: "original claim",
        situation: "s",
        hidden_risk: "r",
        next_move: "m",
        ordinal: 0,
      },
    ],
    created_at: "2026-06-13T00:00:00.000Z",
  };
}

test("immutability: correcting never mutates the original row; correction is a new linked entry", async () => {
  const log = new ProvenanceLog(":memory:");
  const { event: original } = await ingestPacket(log, mkPacket("orig"));
  const originalSnapshot = { ...original };

  const { correction, event: corrEvent } = await correct(log, "orig", {
    reason: "utilization was 30% not 60%",
    correction_kind: "inner",
  });

  // Original row is byte-for-byte unchanged.
  const reread = log.byId("orig")!;
  assert.deepEqual(reread, originalSnapshot, "original row must be immutable");

  // Correction is a NEW entry that links back via source_packet_id.
  assert.equal(correction.source_packet_id, "orig");
  assert.notEqual(corrEvent.packet_id, "orig");
  assert.equal(corrEvent.prev_hash, original.packet_hash, "correction links to the prior chain head");

  // Chain still verifies after correction.
  assert.equal(log.verifyChain().ok, true);

  // The correction shows up in the trail of the original.
  const trail = log.correctionsOf("orig");
  assert.equal(trail.length, 1);
  assert.equal(trail[0]!.id, correction.id);

  log.close();
});

test("each ingest and correction produces a local-first anchor receipt", async () => {
  const log = new ProvenanceLog(":memory:");
  const { receipt } = await ingestPacket(log, mkPacket("p"));
  assert.equal(receipt.anchor_chain, "local");
  assert.equal(receipt.anchor_network, "local-first");
  assert.equal(receipt.packet_id, "p");

  await correct(log, "p", { reason: "fix" });
  const receipts = log.receiptsFor("p");
  assert.equal(receipts.length, 1, "original keeps exactly its own receipt");
  log.close();
});

test("reconcile: sum of monthly_savings == total within ±$1", () => {
  const findings: Pick<SavingsFinding, "monthly_savings">[] = [
    { monthly_savings: 1680 },
    { monthly_savings: 180 },
    { monthly_savings: 1200 },
  ];
  const ok = reconcile(findings, 3060);
  assert.equal(ok.ok, true);
  assert.equal(ok.sum, 3060);
  assert.equal(ok.delta, 0);

  // Within tolerance.
  assert.equal(reconcile(findings, 3060.75).ok, true);
  assert.equal(reconcile(findings, 3059.5).ok, true);

  // Outside tolerance.
  const off = reconcile(findings, 3100);
  assert.equal(off.ok, false);
  assert.equal(off.delta, 40);
});
