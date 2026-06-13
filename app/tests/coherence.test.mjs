// Coherence gate (app) — fails closed if the cockpit ever drifts off the canonical AI-spend story.
// The cockpit reads app/public/data/report.json (the S4 orchestration output). This asserts the
// numbers the pitch + demo depend on: $284 verified / $446 naive / E14 dropped via PR-103 /
// CalendarOps alternative / the ratified policy. If any drifts, the unified `npm test` goes red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const report = JSON.parse(readFileSync(join(HERE, "..", "public", "data", "report.json"), "utf8"));

test("verified savings == $284 (the pitch number)", () => {
  assert.equal(report.total_recommended_savings, 284);
});

test("naive savings == $446 (before the reviewer drops E14)", () => {
  assert.equal(report.naive_savings, 446);
});

test("E14 is present AND dropped (the 'model caught its own error' beat)", () => {
  const e14 = report.findings.find(
    (f) => String(f.finding_id || "").includes("E14") || String(f.source_row_ids || "").includes("E14")
  );
  assert.ok(e14, "E14 finding must exist");
  assert.equal(e14.dropped, true, "E14 must be dropped (refuted via PR-103)");
});

test("ratified policy bans Opus 4.8 for calendar + names CalendarOps", () => {
  const d = report.ratified_decision || {};
  assert.match(d.decision || "", /calendar/i);
  assert.match((d.approved_alternative || "") + "", /CalendarOps/i);
});

test("savings reconcile: surviving findings sum to the total ±$1", () => {
  const surviving = report.findings.filter((f) => !f.dropped);
  const sum = surviving.reduce((a, f) => a + (Number(f.monthly_savings) || 0), 0);
  assert.ok(Math.abs(sum - report.total_recommended_savings) <= 1, `sum ${sum} vs ${report.total_recommended_savings}`);
});
