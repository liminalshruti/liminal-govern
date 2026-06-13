import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { enforceCap, applyCapGuard, makeOpusRuling, type ModelRuling } from "../src/enforce.js";
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

// The live forced-tool call must NEVER combine `tool_choice` with extended thinking — the two are
// incompatible. Capture the exact request params via a fake client (offline, deterministic) so a
// regression that re-introduces `thinking` alongside a forced tool is caught without a network hop.
test("the live request forces record_verdict and never enables extended thinking", async () => {
  const calls: Record<string, unknown>[] = [];
  const fakeClient = {
    messages: {
      create: async (args: Record<string, unknown>) => {
        calls.push(args);
        return { content: [{ type: "tool_use", input: { verdict: "approve", refusal_kind: "none", rationale: "ok" } }] };
      },
    },
  } as unknown as Anthropic;
  const ruling = makeOpusRuling(fakeClient, "claude-opus-4-8");
  await ruling(1500, UNDER_CAP);
  assert.equal(calls.length, 1, "request was issued exactly once");
  const captured = calls[0]!;
  assert.deepEqual(captured.tool_choice, { type: "tool", name: "record_verdict" });
  assert.ok(!("thinking" in captured), "forced tool_choice must not be combined with extended thinking");
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

// Live confirmation that an in-lane, under-cap decision is ALLOWED (not just guard-passed offline).
test(
  "LIVE: bounded Opus agent approves an in-lane, under-cap decision",
  { skip: process.env.ANTHROPIC_API_KEY ? false : "ANTHROPIC_API_KEY not set", timeout: 60_000 },
  async () => {
    const verdicts = await enforceCap(1500, [UNDER_CAP]);
    assert.equal(verdicts[0]!.verdict, "approve");
    assert.equal(verdicts[0]!.refusal_kind, "none");
    assert.equal(verdicts[0]!.source, "opus");
  },
);
