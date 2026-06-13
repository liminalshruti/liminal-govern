// Fixture-truth tests — assert B encodes the demo's finding correctly. These run NOW (no workflow
// needed) so U1 can trust the dataset + knows the target numbers. See data/README.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadUsage, loadPrs, loadOkr, loadAgents, opusSpendByCategory, opusTotal } from "./helpers.js";

test("Opus 4.8 spend totals $4,500", () => {
  assert.equal(opusTotal(), 4500);
});

test("category split matches the embedded finding", () => {
  const c = opusSpendByCategory();
  assert.equal(c.product_dev, 2520);     // 56%
  assert.equal(c.security_hardening, 1080); // 24% — under the 40% target
  assert.equal(c.calendar_admin, 360);   // incl. the E14 trap
  assert.equal(c.summarization, 135);
  assert.equal(c.unclassified, 405);
});

test("misaligned-looking spend is ~11% (calendar + summarization)", () => {
  const c = opusSpendByCategory();
  const misaligned = c.calendar_admin + c.summarization;
  assert.equal(misaligned, 495);
  assert.ok(Math.abs(misaligned / opusTotal() - 0.11) < 0.005);
});

test("security hardening is under-allocated vs the 40% OKR target", () => {
  const c = opusSpendByCategory();
  const securityPct = c.security_hardening / opusTotal();
  const target = loadOkr().objectives.find((o) => o.id === "O2").allocation;
  assert.equal(target, 0.4);
  assert.ok(securityPct < target, `security ${securityPct} should be < ${target}`);
  assert.ok(Math.abs(securityPct - 0.24) < 0.005);
});

test("the adversarial-verifier trap is wired: E14 is labeled calendar but PR-103 proves it's product", () => {
  const e14 = loadUsage().find((e) => e.event_id === "E14");
  assert.equal(e14.task_category, "calendar_admin"); // naive label
  const pr = loadPrs().find((p) => p.linked_usage_event === "E14");
  assert.ok(pr, "E14 must have a linked PR");
  assert.equal(pr.workstream, "product"); // the truth a reviewer must catch -> drop the savings claim
});

test("OKR baseline is well-formed (allocations sum to 1.0, governs Opus 4.8)", () => {
  const okr = loadOkr();
  assert.equal(okr.approved_model, "claude-opus-4-8");
  const sum = okr.objectives.reduce((a, o) => a + o.allocation, 0);
  assert.ok(Math.abs(sum - 1.0) < 1e-9);
});

test("agent registry offers a cheaper verified alternative for calendar work", () => {
  const cal = loadAgents().agents.find((a) => a.approved_for?.includes("calendar_management"));
  assert.ok(cal, "a calendar-capable agent must exist");
  assert.equal(cal.verified, true);
  assert.equal(cal.cost_tier, "low"); // cheaper than Opus -> the agent-fit recommendation
});
