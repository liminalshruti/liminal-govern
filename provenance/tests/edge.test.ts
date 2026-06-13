/**
 * Adversarial edge cases probed during QA hardening (build-day/qa-core):
 * empty log, exact ±$1 reconcile boundary, correction-of-a-correction, and
 * duplicate packet ids. Each behavior is correct today; these tests lock it in
 * so a regression in any boundary is caught.
 */
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
        quoted: `claim ${id}`,
        situation: "s",
        hidden_risk: "r",
        next_move: "m",
        ordinal: 0,
      },
    ],
    created_at: "2026-06-13T00:00:00.000Z",
  };
}

test("empty log verifies as an intact chain (length 0, brokenIndex -1)", () => {
  const log = new ProvenanceLog(":memory:");
  const r = log.verifyChain();
  assert.equal(r.ok, true);
  assert.equal(r.length, 0);
  assert.equal(r.brokenIndex, -1);
  log.close();
});

test("reconcile: the ±$1 boundary is inclusive (delta == 1 ok; delta > 1 fails)", () => {
  const findings: Pick<SavingsFinding, "monthly_savings">[] = [{ monthly_savings: 100 }];
  // Exactly +$1 and exactly -$1 are inside the inclusive boundary.
  assert.equal(reconcile(findings, 101).ok, true);
  assert.equal(reconcile(findings, 101).delta, 1);
  assert.equal(reconcile(findings, 99).ok, true);
  assert.equal(reconcile(findings, 99).delta, 1);
  // A cent past the boundary fails.
  assert.equal(reconcile(findings, 101.01).ok, false);
  assert.equal(reconcile(findings, 98.99).ok, false);
});

test("correction-of-a-correction: chain stays intact and each links to its own source", async () => {
  const log = new ProvenanceLog(":memory:");
  await ingestPacket(log, mkPacket("orig"));
  const c1 = await correct(log, "orig", { reason: "first fix", correction_kind: "inner" });
  const c2 = await correct(log, c1.correction.id, { reason: "fix the fix", correction_kind: "inner" });

  // c2 corrects c1, not orig.
  assert.equal(c2.correction.source_packet_id, c1.correction.id);
  assert.notEqual(c1.correction.id, c2.correction.id);

  // Three linked rows, still verifiable.
  const v = log.verifyChain();
  assert.equal(v.ok, true);
  assert.equal(v.length, 3);

  // Trails resolve to the right level: orig has one corrector (c1); c1 has one corrector (c2).
  assert.deepEqual(log.correctionsOf("orig").map((r) => r.id), [c1.correction.id]);
  assert.deepEqual(log.correctionsOf(c1.correction.id).map((r) => r.id), [c2.correction.id]);
  log.close();
});

test("duplicate packet ids: log appends both and the chain still verifies", async () => {
  const log = new ProvenanceLog(":memory:");
  await ingestPacket(log, mkPacket("same"));
  await ingestPacket(log, mkPacket("same"));
  assert.equal(log.byPacketId("same").length, 2, "id is not a uniqueness constraint; append-only keeps both");
  assert.equal(log.verifyChain().ok, true);
  log.close();
});
