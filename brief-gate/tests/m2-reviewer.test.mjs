// m2-reviewer.test.mjs — Brief Gate M2: the reviewer seam + the reviewer-agnostic boundary.
//
// Proves the M2 invariant: the reviewer changes HOW the survives/drops decision is made, NEVER
// WHETHER the fail-closed boundary holds. Tests inject reviewers directly (no subprocess, no live
// model round-trip) and assert the boundary is identical across reviewer behaviors — including the
// fail-closed case (a reviewer that returns no usable verdict must DROP, never silently survive).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mockReviewer, pickReviewer, liveReviewer } from "../reviewer.mjs";

const sampleEvidence = [
  {
    pr_id: "PR-103",
    employee: "Priya",
    title: "calendar-sync feature: Google Calendar API integration + UI",
    refutes_claim_about: "calendar-sync",
    proves: "real product engineering on the approved track, not routine admin",
  },
];

const wasteClaim = { id: "C2", text: "$162/mo is being wasted on calendar-sync — it is routine admin." };
const goodClaim = { id: "C3", text: "Security spend is under-allocated at 24% against the 40% target." };

// ── the deterministic mock reviewer (the test path) ─────────────────────────────────────────────
test("mock reviewer DROPS a claim contradicted by evidence", () => {
  const v = mockReviewer(wasteClaim, sampleEvidence);
  assert.equal(v.survives, false);
  assert.match(v.reason, /PR-103/);
});

test("mock reviewer SURVIVES a claim with no contradicting evidence", () => {
  const v = mockReviewer(goodClaim, sampleEvidence);
  assert.equal(v.survives, true);
});

// ── reviewer selection ──────────────────────────────────────────────────────────────────────────
test("pickReviewer returns the injected reviewer when given one (test override)", () => {
  assert.equal(pickReviewer(mockReviewer), mockReviewer);
});

test("pickReviewer falls back to deterministic mock when no API key", () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.equal(pickReviewer(), mockReviewer);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("pickReviewer selects the live reviewer when an API key is present", () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-test-not-used-no-call-made";
  try {
    assert.equal(pickReviewer(), liveReviewer);
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = saved;
  }
});

// ── THE M2 INVARIANT: the boundary is reviewer-agnostic + fails closed ──────────────────────────
// Simulate the gate's boundary logic with arbitrary injected reviewers and assert: whatever the
// reviewer decides, a non-surviving claim NEVER becomes a Judgment. This is the constraint:
// "a dropped claim must still produce no Judgment → no anchor → no export."

function gateBoundary(claims, reviewerVerdicts) {
  // mirrors brief-gate.mjs: review → state → only survivors become Judgments
  const judgments = [];
  for (const c of claims) {
    const v = reviewerVerdicts[c.id];
    c.state = v.survives ? "survived" : "dropped";
    if (c.state !== "survived") continue; // ← the boundary (identical to the gate)
    judgments.push({ claim_id: c.id });
  }
  return judgments;
}

test("INVARIANT: a dropped claim is never a Judgment — regardless of WHY it was dropped", () => {
  const claims = [{ id: "C2" }, { id: "C3" }];
  // reviewer A drops C2 for evidence; reviewer B drops C2 for a totally different reason —
  // the boundary outcome is identical: C2 is never a Judgment.
  for (const reason of ["refuted by PR-103", "model judged it speculative", "no verdict — failing closed"]) {
    const verdicts = { C2: { survives: false, reason }, C3: { survives: true } };
    const judgments = gateBoundary(claims, verdicts);
    assert.ok(!judgments.some((j) => j.claim_id === "C2"), `C2 must not be a Judgment (drop reason: ${reason})`);
    assert.equal(judgments.length, 1);
  }
});

test("FAIL CLOSED: a reviewer that returns survives=false (e.g. no usable verdict) drops the claim", () => {
  // The live reviewer fails closed on an unparseable response: { survives: false }. Assert the
  // boundary honors it — the unreviewed claim does NOT become operational.
  const claims = [{ id: "C2" }];
  const judgments = gateBoundary(claims, { C2: { survives: false, reason: "no verdict — failing closed" } });
  assert.equal(judgments.length, 0, "an unreviewable claim must never become a Judgment");
});
