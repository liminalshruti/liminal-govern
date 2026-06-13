// coherence.test.mjs — fail closed if the cockpit drifts off the pitch's story.
//
// D1: the cockpit must tell the AI-spend governance story (Opus 4.8 / $284 verified /
// E14 dropped via PR-103 / CalendarOps), NOT the legacy SaaS-seat audit ($5,104). This
// asserts the baked artifact the cockpit ships matches the S4 report's headline numbers
// and the "model caught its own error" beat. Wired into the unified gate (test-all.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACT = resolve(HERE, "../src/generated/engine-findings.json");
const REPORT = resolve(HERE, "../../out/report.json");

const baked = JSON.parse(readFileSync(ARTIFACT, "utf8"));
const report = JSON.parse(readFileSync(REPORT, "utf8"));

test("cockpit tells the AI-spend story, not the SaaS-seat one", () => {
  assert.equal(baked.dataset, "ai-usage-governance");
  assert.equal(baked.governed_model, "claude-opus-4-8");
  assert.equal(baked.opus_total, 4500);
});

test("verified savings == S4 report total ($284) ±1", () => {
  assert.equal(baked.monthly_savings_total, report.total_recommended_savings);
  assert.ok(Math.abs(baked.monthly_savings_total - 284) <= 1, `got ${baked.monthly_savings_total}`);
  assert.equal(baked.naive_savings, 446);
  assert.equal(baked.dropped_total, 162);
});

test("displayed (surviving) savings sum to the verified total ±1", () => {
  const sum = baked.findings
    .filter((f) => !f.dropped)
    .reduce((s, f) => s + f.savings.monthly_savings, 0);
  assert.ok(Math.abs(sum - 284) <= 1, `surviving sum=${sum}, expected 284`);
});

test("E14 is present but dropped (the adversarial-reviewer beat)", () => {
  const e14 = baked.findings.find((f) => f.savings.finding_id === "F-E14");
  assert.ok(e14, "F-E14 must be present");
  assert.equal(e14.dropped, true);
  assert.ok(/PR-103/.test(e14.drop_reason ?? ""), "drop_reason must cite PR-103");
  assert.equal(e14.receipt, null, "a dropped claim must not be anchored");
});

test("reconcile + chain verified by the real provenance lib", () => {
  assert.equal(baked.reconcile.ok, true);
  assert.equal(baked.chain_verified, true);
  assert.equal(baked.chain_length, 6); // 5 surviving findings + ratified decision
});

test("ratified policy disallows Opus 4.8 for calendar management", () => {
  const pol = baked.ratified_decision.agent_policy.opus_4_8_disallowed_for;
  assert.ok(pol.includes("calendar_management"), "policy must disallow calendar_management");
  assert.ok(/calendar management/i.test(baked.ratified_decision.decision));
});

test("CalendarOps is the recommended verified agent for calendar work", () => {
  const cal = baked.findings.find((f) => f.category === "calendar_admin" && !f.dropped);
  assert.ok(cal, "a surviving calendar finding must exist");
  assert.equal(cal.approved_alternative_id, "calendarops");
});
