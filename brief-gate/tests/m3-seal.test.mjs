// m3-seal.test.mjs — Brief Gate M3: per-claim ratification + seal/export (fail-closed).
//
// Proves the M3 boundary: survived-review is NOT enough to export. A Ratified Brief is exportable
// ONLY IF every Judgment is ratify/amend/defer — a 'pending' (un-ratified) Judgment blocks export.
// → unratified claims literally cannot become operational (enter the sealed/exportable brief).

import { test } from "node:test";
import assert from "node:assert/strict";
import { seal } from "../seal.mjs";

// A minimal report shape (3 surviving Judgments, mirrors what M1/M2 produce).
const report = {
  judgments: [
    { claim_id: "C1", text: "claim one", packet_hash: "a".repeat(64) },
    { claim_id: "C3", text: "claim three", packet_hash: "b".repeat(64) },
    { claim_id: "C4", text: "claim four", packet_hash: "c".repeat(64) },
  ],
};

test("all ratified → SEALED + exportable, with a signature", () => {
  const r = seal(report, [
    { claim_id: "C1", disposition: "ratify" },
    { claim_id: "C3", disposition: "ratify" },
    { claim_id: "C4", disposition: "ratify" },
  ]);
  assert.equal(r.exportable, true);
  assert.match(r.ratified_brief.signature, /^[0-9a-f]{64}$/);
  assert.equal(r.ratified_brief.judgments.length, 3);
});

test("FAIL CLOSED: a pending (un-ratified) Judgment blocks export", () => {
  const r = seal(report, [
    { claim_id: "C1", disposition: "ratify" },
    // C3 has NO disposition → pending
    { claim_id: "C4", disposition: "ratify" },
  ]);
  assert.equal(r.exportable, false, "any pending Judgment must block export");
  assert.equal(r.ratified_brief, null, "an un-exportable brief produces NO ratified brief");
  assert.match(r.blocked_reason, /C3/, "the blocker must name the unratified claim");
});

test("THE BOUNDARY: an unratified claim never enters the sealed brief", () => {
  const r = seal(report, [
    { claim_id: "C1", disposition: "ratify" },
    { claim_id: "C4", disposition: "ratify" },
  ]); // C3 pending
  // Even though C3 survived review, with no ratification it cannot be operational → not exportable.
  assert.equal(r.exportable, false);
  // And if we DID force a brief, C3 must not be in it (it isn't — ratified_brief is null when blocked).
  assert.equal(r.ratified_brief, null);
});

test("a 'drop' at ratification excludes the Judgment but does NOT block export", () => {
  const r = seal(report, [
    { claim_id: "C1", disposition: "ratify" },
    { claim_id: "C3", disposition: "drop" }, // user drops it at ratification
    { claim_id: "C4", disposition: "ratify" },
  ]);
  assert.equal(r.exportable, true, "an explicit drop is a decision — it does not block export");
  assert.equal(r.ratified_brief.judgments.length, 2, "the dropped Judgment is excluded from the sealed brief");
  assert.ok(!r.ratified_brief.judgments.some((j) => j.claim_id === "C3"));
});

test("a 'defer' is a valid ratifying decision (allows export)", () => {
  const r = seal(report, [
    { claim_id: "C1", disposition: "ratify" },
    { claim_id: "C3", disposition: "defer" },
    { claim_id: "C4", disposition: "ratify" },
  ]);
  assert.equal(r.exportable, true);
  assert.ok(r.ratified_brief.judgments.some((j) => j.claim_id === "C3"));
});

test("AMEND is append-only: the correction records from→to, original preserved", () => {
  const r = seal(report, [
    { claim_id: "C1", disposition: "ratify" },
    { claim_id: "C3", disposition: "amend", amended_text: "claim three (corrected)" },
    { claim_id: "C4", disposition: "ratify" },
  ]);
  assert.equal(r.exportable, true);
  const c3 = r.ratified_brief.judgments.find((j) => j.claim_id === "C3");
  assert.equal(c3.text, "claim three (corrected)", "the sealed text is the amended text");
  const corr = r.ratified_brief.corrections.find((x) => x.claim_id === "C3");
  assert.equal(corr.from, "claim three", "the correction preserves the original (append, not overwrite)");
  assert.equal(corr.to, "claim three (corrected)");
});

test("seal is deterministic — same inputs → same signature", () => {
  const dispositions = [
    { claim_id: "C1", disposition: "ratify" },
    { claim_id: "C3", disposition: "ratify" },
    { claim_id: "C4", disposition: "ratify" },
  ];
  const a = seal(report, dispositions);
  const b = seal(report, dispositions);
  assert.equal(a.ratified_brief.signature, b.ratified_brief.signature);
});
