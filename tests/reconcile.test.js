// reconcile() unit tests — proves the gate logic before the workflow exists.
// Target story (see data/README.md): naive savings $446 -> the reviewer drops the E14 calendar-sync
// claim ($162) -> verified $284 = calendar(real) $162 + summarization $122.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile, findingsCiting } from "./reconcile.js";

const VERIFIED = [
  { finding_id: "F-cal", monthly_savings: 162, source_row_ids: ["E12", "E13"] },
  { finding_id: "F-sum", monthly_savings: 122, source_row_ids: ["E15", "E16"] },
  { finding_id: "F-e14", monthly_savings: 162, source_row_ids: ["E14"], dropped: true, drop_reason: "PR-103: E14 is product, not admin" },
];

test("surviving findings reconcile to $284 ±$1", () => {
  const r = reconcile(VERIFIED, 284);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.surviving, 2);
});

test("counting the dropped E14 claim breaks reconciliation (the trap must be excluded)", () => {
  const naive = VERIFIED.map((f) => ({ ...f, dropped: false }));
  const r = reconcile(naive, 284);
  assert.equal(r.ok, false); // sum would be 446, not 284
  assert.equal(r.sum, 446);
});

test("the E14 trap finding is identifiable + must be dropped", () => {
  const e14Findings = findingsCiting(VERIFIED, "E14");
  assert.equal(e14Findings.length, 1);
  assert.equal(e14Findings[0].dropped, true);
});

test("tolerance: rounding within $1 is accepted (e.g. 283.5)", () => {
  const r = reconcile([{ monthly_savings: 162 }, { monthly_savings: 121.5 }], 284);
  assert.ok(r.ok, JSON.stringify(r));
});
