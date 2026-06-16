// m1.test.mjs — Brief Gate M1 acceptance tests (the fail-closed proof).
//
// Proves SPEC_BRIEF_GATE_V1 § M1: claims extracted from a brief → adversarial reviewer drops a
// contradicted claim → only surviving claims become Judgments anchored to a verified chain → the
// dropped claim CANNOT enter the trusted record (the system-law boundary, enforced).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const briefGateDir = resolve(__dirname, "..");
const mjs = join(briefGateDir, "brief-gate.mjs");
const outPath = join(briefGateDir, "out/report.json");

function run() {
  // Force the DETERMINISTIC reviewer — the acceptance test must pass with NO live model round-trip.
  // (The live Opus 4.8 reviewer is the demo path; the boundary it feeds is identical either way.)
  execFileSync("node", [mjs], {
    cwd: resolve(briefGateDir, ".."),
    stdio: "pipe",
    env: { ...process.env, BRIEF_GATE_REVIEWER: "mock" },
  });
  return JSON.parse(readFileSync(outPath, "utf8"));
}

test("claims are extracted from the brief prose", () => {
  const r = run();
  assert.ok(r.total_claims >= 4, `expected >=4 claims, got ${r.total_claims}`);
});

test("the adversarial reviewer drops the contradicted claim (the self-catch)", () => {
  const r = run();
  assert.equal(r.dropped_count, 1, "exactly one claim should be dropped");
  assert.match(r.self_catch, /PR-103/, "the drop must cite the contradicting evidence");
  assert.equal(r.dropped[0].claim_id, "C2", "C2 (the '$162 waste' claim) is the one refuted");
});

test("THE BOUNDARY: the dropped claim is NOT in the anchored Judgments", () => {
  const r = run();
  const anchoredIds = r.judgments.map((j) => j.claim_id);
  assert.ok(!anchoredIds.includes("C2"), "a dropped claim must NEVER become an anchored Judgment");
  assert.equal(r.surviving_count, r.judgments.length, "every survivor is anchored; nothing else is");
});

test("surviving claims become Judgments with packet hashes", () => {
  const r = run();
  assert.equal(r.surviving_count, 3);
  for (const j of r.judgments) {
    assert.match(j.packet_hash, /^[0-9a-f]{64}$/, "each Judgment carries a sha256 packet hash");
  }
});

test("the provenance chain verifies (hash-linked, append-only)", () => {
  const r = run();
  assert.equal(r.chain_verified, true, "the anchored chain must verify");
});

test("M1 is deterministic — two runs produce identical Judgment hashes", () => {
  const a = run();
  const b = run();
  assert.deepEqual(
    a.judgments.map((j) => j.packet_hash),
    b.judgments.map((j) => j.packet_hash),
    "same brief + evidence → same Judgment hashes",
  );
});
