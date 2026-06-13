import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/analyze.js";
import { reconcileFindings } from "../src/anchor.js";

test("analyze is deterministic — two runs are byte-identical", () => {
  const a = analyze("q2-spend");
  const b = analyze("q2-spend");
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("findings reconcile to the headline total within $1", () => {
  const report = analyze("q2-spend");
  const rec = reconcileFindings(report.findings, report.monthly_savings_total);
  assert.ok(rec.ok, `reconcile failed: sum=${rec.sum} total=${rec.total} delta=${rec.delta}`);
  assert.ok(rec.delta <= 1);
});

test("every finding cites source rows, recomputed utilization, action, and savings", () => {
  const report = analyze("q2-spend");
  assert.ok(report.findings.length > 0, "expected at least one finding");
  for (const f of report.findings) {
    assert.ok(f.source_row_ids.length >= 1, "finding must cite source rows");
    assert.ok(typeof f.utilization_pct === "number");
    assert.ok(f.utilization_pct < 70, "a finding implies under-utilization (<70%)");
    assert.ok(f.recommended_action.length > 0);
    assert.ok(f.monthly_savings > 0);
    // The cited row must actually exist in the utilization table.
    const cited = report.utilization.find((u) => u.row_id === f.source_row_ids[0]);
    assert.ok(cited, `cited row ${f.source_row_ids[0]} must be in the utilization table`);
  }
});

test("utilization is recomputed from raw active seats, not assumed", () => {
  const report = analyze("q2-spend");
  for (const u of report.utilization) {
    const expected = Math.round((u.active_seats_30d / u.seats_purchased) * 1000) / 10;
    assert.equal(u.utilization_pct, expected, `util mismatch for ${u.row_id}`);
  }
});

test("healthy vendors (>=70%) produce no finding", () => {
  const report = analyze("q2-spend");
  const healthyIds = new Set(report.utilization.filter((u) => u.healthy).map((u) => u.row_id));
  for (const f of report.findings) {
    assert.ok(!healthyIds.has(f.source_row_ids[0]!), `healthy ${f.source_row_ids[0]} should not have a finding`);
  }
});

test("a second fixture (sample-spend) also analyzes and reconciles", () => {
  const report = analyze("sample-spend");
  assert.ok(report.rows_analyzed > 0);
  const rec = reconcileFindings(report.findings, report.monthly_savings_total);
  assert.ok(rec.ok);
});
