// m4-extract-reentry.test.mjs — Brief Gate M4: the extraction seam + prior-Judgment re-entry.
//
// Proves M4: (1) extraction is a seam (live AI for free-form briefs / deterministic parser for tests),
// and (2) the vault compounds — a new brief re-enters Judgments ratified in a PRIOR brief. All
// deterministic: no live model round-trip.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parserExtractor, pickExtractor, liveExtractor } from "../extractor.mjs";
import { recordSeal, findPriorJudgments, loadVault } from "../vault.mjs";
import { writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── extraction seam ─────────────────────────────────────────────────────────────────────────────
test("parser extracts numbered claims from a structured brief", () => {
  const claims = parserExtractor("Findings:\n1. First claim here.\n2. Second claim here.\n");
  assert.equal(claims.length, 2);
  assert.equal(claims[0].id, "C1");
  assert.equal(claims[0].state, "candidate");
});

test("parser returns 0 claims on free-form prose (→ why the live extractor is needed)", () => {
  const claims = parserExtractor("The team usage held steady. Security is under target. Spend will rise.");
  assert.equal(claims.length, 0, "free-form prose has no numbered list — the live extractor handles it");
});

test("pickExtractor uses the deterministic parser when no API key (the test path)", () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.equal(pickExtractor(), parserExtractor);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("pickExtractor selects the live extractor when an API key is present", () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-test-not-used";
  try {
    assert.equal(pickExtractor(), liveExtractor);
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = saved;
  }
});

// ── re-entry (the vault compounds) ──────────────────────────────────────────────────────────────
function tmpVault() {
  return join(mkdtempSync(join(tmpdir(), "bg-vault-")), "vault.json");
}

test("a sealed brief is recorded to the vault (append-only)", () => {
  const v = tmpVault();
  recordSeal(v, { signature: "sig1", judgments: [{ claim_id: "C3", text: "Security spend under-allocated at 24% vs 40% target", disposition: "ratify" }] }, { briefName: "june.md", sealedAt: "2026-06-15" });
  const vault = loadVault(v);
  assert.equal(vault.sealed_briefs.length, 1);
  assert.equal(vault.sealed_briefs[0].judgments[0].claim_id, "C3");
});

test("RE-ENTRY: a new brief's claim references a prior ratified Judgment", () => {
  const v = tmpVault();
  recordSeal(v, { signature: "sig1", judgments: [{ claim_id: "C3", text: "Security-hardening spend is under-allocated at 24% against the 40% OKR target", disposition: "amend" }] }, { briefName: "june.md", sealedAt: "2026-06-15" });

  // July's claim is about the SAME subject → it should re-enter June's Judgment.
  const julyClaims = [{ claim_id: "C1", text: "Security-hardening spend is still under-allocated at 24% against the 40% OKR target" }];
  const matches = findPriorJudgments(v, julyClaims);
  assert.equal(matches.length, 1, "the security claim re-enters June's prior Judgment");
  assert.equal(matches[0].claim_id, "C1");
  assert.equal(matches[0].prior.prior_claim_id, "C3");
  assert.equal(matches[0].prior.from_brief, "june.md");
  assert.equal(matches[0].prior.disposition, "amend");
});

test("an unrelated claim does NOT falsely re-enter", () => {
  const v = tmpVault();
  recordSeal(v, { signature: "sig1", judgments: [{ claim_id: "C3", text: "Security-hardening spend is under-allocated at 24% against the 40% OKR target", disposition: "ratify" }] }, { briefName: "june.md", sealedAt: "2026-06-15" });
  const matches = findPriorJudgments(v, [{ claim_id: "X1", text: "We onboarded two new engineers this month." }]);
  assert.equal(matches.length, 0, "an unrelated claim must not match a prior Judgment");
});
