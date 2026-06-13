import { test } from "node:test";
import assert from "node:assert/strict";
import { enforceCap, applyCapGuard, type ModelRuling } from "../src/enforce.js";
import type { SpendDecision } from "../src/types.js";

const OVER_CAP: SpendDecision = {
  id: "T-OVER",
  description: "Renew Vercel Enterprise at full seats despite low utilization.",
  vendor: "Vercel",
  amount: 2400,
  lane: "renewal",
};

const UNDER_CAP: SpendDecision = {
  id: "T-UNDER",
  description: "Rightsize Airtable to active seats.",
  vendor: "Airtable",
  amount: 140,
  lane: "seat-rightsizing",
};

const SURVEILLANCE: SpendDecision = {
  id: "T-SURV",
  description: "Add per-employee keystroke monitoring to flag low usage by name.",
  vendor: "Cursor",
  amount: 50,
  lane: "monitoring",
};

const approveRuling = async (): Promise<ModelRuling> => ({
  verdict: "approve",
  refusal_kind: "none",
  rationale: "model approved",
});

test("the cap guard refuses an over-cap decision even if the model approved it", () => {
  const v = applyCapGuard(1500, OVER_CAP, { verdict: "approve", refusal_kind: "none", rationale: "ok" }, "test");
  assert.equal(v.verdict, "refuse");
  assert.equal(v.refusal_kind, "over-cap");
  assert.equal(v.source, "deterministic-guard");
});

test("enforceCap refuses over-cap (deterministic, injected ruling)", async () => {
  const verdicts = await enforceCap(1500, [OVER_CAP], { ruling: approveRuling });
  assert.equal(verdicts.length, 1);
  assert.equal(verdicts[0]!.verdict, "refuse");
  assert.equal(verdicts[0]!.refusal_kind, "over-cap");
});

test("enforceCap approves an in-lane, under-cap decision (model authority)", async () => {
  const verdicts = await enforceCap(1500, [UNDER_CAP], { ruling: approveRuling });
  assert.equal(verdicts[0]!.verdict, "approve");
});

test("enforceCap honors a model refusal for surveillance under the cap", async () => {
  const surveillanceRuling = async (): Promise<ModelRuling> => ({
    verdict: "refuse",
    refusal_kind: "surveillance",
    rationale: "judges spend, not people",
  });
  const verdicts = await enforceCap(1500, [SURVEILLANCE], { ruling: surveillanceRuling });
  assert.equal(verdicts[0]!.verdict, "refuse");
  assert.equal(verdicts[0]!.refusal_kind, "surveillance");
});

// Live verification on Opus with the real key. Skips only if the key is absent.
test(
  "LIVE: bounded Opus agent refuses an over-cap decision",
  { skip: process.env.ANTHROPIC_API_KEY ? false : "ANTHROPIC_API_KEY not set", timeout: 60_000 },
  async () => {
    const verdicts = await enforceCap(1500, [OVER_CAP]);
    assert.equal(verdicts[0]!.verdict, "refuse");
    assert.equal(verdicts[0]!.refusal_kind, "over-cap");
    assert.equal(verdicts[0]!.model, "claude-opus-4-8");
  },
);
