#!/usr/bin/env node
// brief-gate.mjs — Brief Gate M1: the deterministic core of the claim-to-Judgment gate.
//
// Implements liminal-ip/03-architecture/SPEC_BRIEF_GATE_V1 § M1 ("vault + self-catch on a brief").
// Lifts liminal-govern's proven loop (extract → adversarial-drop → anchor) but on an ARBITRARY
// brief (prose), not the fixed spend fixture. Proves: claims extracted from a brief → an adversarial
// reviewer drops a weak/contradicted one against evidence → surviving claims become Judgments →
// anchored to the real provenance chain (../provenance) → a report.
//
//   The wedge: "Before an AI-generated business claim becomes operational, Liminal forces it
//   through correction and ratification." M1 proves the correction half; ratification UI = M2.
//
// Deterministic by design (no wall-clock in the report) so re-runs regenerate identically and the
// tests need no API key. The LIVE Opus 4.8 adversarial reviewer is the M2 layer; M1 encodes the
// same drop the live reviewer reaches, exactly as govern's spend-audit.mjs does.
//
// Usage:  node brief-gate/brief-gate.mjs [brief.md] [evidence.json] [out/report.json]
// Lane:   Brief Gate M1. Consumes ../provenance (built dist). Touches brief-gate/out/.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { ProvenanceLog, anchorLocal } from "../provenance/dist/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const briefPath = process.argv[2] || join(__dirname, "data/sample-brief.md");
const evidencePath = process.argv[3] || join(__dirname, "data/evidence.json");
const outPath = process.argv[4] || join(__dirname, "out/report.json");

// ── 1 · ingest ────────────────────────────────────────────────────────────────────────────────
const briefText = readFileSync(briefPath, "utf8");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));

// ── 2 · extract candidate claims from the brief prose ───────────────────────────────────────────
// M1 extraction is deterministic: pull the numbered "1. … 2. …" claim list from the brief. (M4
// generalizes this to an AI extraction stage for free-form briefs; the loop downstream is identical.)
function extractClaims(text) {
  const claims = [];
  const re = /^\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.\s|\n*$)/gms;
  let m;
  while ((m = re.exec(text)) !== null) {
    const body = m[2].replace(/\s+/g, " ").trim();
    claims.push({ id: `C${m[1]}`, text: body, state: "candidate" });
  }
  return claims;
}
const claims = extractClaims(briefText);

// ── 3 · adversarial review: drop claims contradicted by evidence ────────────────────────────────
// A claim is REFUTED if a piece of evidence proves the thing it asserts is false. M1 wires the
// PR-103 contradiction (the brief's "$162 calendar waste" is refuted because PR-103 proves the
// calendar-sync work is real product engineering). Same shape as govern's E14 self-catch, on prose.
function reviewClaim(claim, prEvidence) {
  for (const pr of prEvidence) {
    const subject = pr.refutes_claim_about?.toLowerCase();
    const claimL = claim.text.toLowerCase();
    // The claim is about the same subject AND asserts it's waste/admin → the PR refutes it.
    const assertsWaste = /\b(wast|admin|should not run|belongs on|routine)\b/.test(claimL);
    if (subject && claimL.includes(subject) && assertsWaste) {
      return {
        survives: false,
        refuted_by: pr.pr_id,
        reason: `Refuted by adversarial review: ${pr.pr_id} (${pr.employee}, "${pr.title}") proves the ${subject} work is ${pr.proves}. The claim that it is waste/admin is dropped.`,
      };
    }
  }
  return { survives: true };
}
for (const c of claims) {
  const verdict = reviewClaim(c, evidence.pr_evidence || []);
  c.verdict = verdict;
  c.state = verdict.survives ? "survived" : "dropped";
}

// ── 4 · surviving claims become JUDGMENTS, anchored to the provenance chain ─────────────────────
// THE BOUNDARY (system law): only surviving (un-refuted) claims can become Judgments and be anchored.
// A dropped claim has no Judgment → it cannot enter the trusted record → it cannot become operational.
const dbPath = join(__dirname, "out/brief.provenance.db");
mkdirSync(dirname(dbPath), { recursive: true });
if (existsSync(dbPath)) rmSync(dbPath); // deterministic: fresh chain each run

const log = new ProvenanceLog(dbPath);
const judgments = [];
for (const c of claims) {
  if (c.state !== "survived") continue; // ← the boundary: dropped claims never anchored
  // A Judgment is a Packet (the corrected-judgment object) + the reads that produced it (the
  // adversarial review). This is the canonical provenance unit — same shape the chain anchors.
  const packet = {
    id: c.id,
    kind: "judgment",
    context: c.text,
    source_packet_id: null,
    user_correction: null,
    correction_kind: null,
    chosen_agent: "adversarial-reviewer",
    created_at: "2026-06-15T00:00:00.000Z", // fixed → deterministic re-runs
  };
  const reads = [
    {
      agent_name: "adversarial-reviewer",
      archetype: "skeptic",
      quoted: c.text,
      situation: "claim survived adversarial review (no contradicting evidence)",
      hidden_risk: null,
      next_move: "promote to ratification (M2)",
      refusal: null,
      refusal_kind: null,
      ordinal: 0,
    },
  ];
  const ev = log.append({ id: c.id, kind: "packet", packet_id: c.id, packet, reads });
  anchorLocal(ev.packet_hash, ev.prev_hash);
  judgments.push({ claim_id: c.id, text: c.text, packet_hash: ev.packet_hash, prev_hash: ev.prev_hash });
}

// ── 5 · emit the report (deterministic) ─────────────────────────────────────────────────────────
const dropped = claims.filter((c) => c.state === "dropped");
const report = {
  brief: "sample-brief.md",
  total_claims: claims.length,
  surviving_count: judgments.length,
  dropped_count: dropped.length,
  judgments: judgments.map((j) => ({ claim_id: j.claim_id, text: j.text, packet_hash: j.packet_hash })),
  dropped: dropped.map((c) => ({ claim_id: c.id, text: c.text, drop_reason: c.verdict.reason })),
  // The marquee M1 fact: the gate caught a weak claim and refused to anchor it.
  self_catch: dropped.length > 0 ? dropped[0].verdict.reason : null,
  chain_verified: log.verifyChain().ok,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
log.close();

// ── 6 · console summary ─────────────────────────────────────────────────────────────────────────
console.log(`brief-gate M1: ${briefPath.replace(root + "/", "")}`);
console.log(`  extracted ${report.total_claims} claims`);
console.log(`  adversarial review dropped ${report.dropped_count}: ${report.self_catch ? "✓ self-catch" : "(none)"}`);
for (const d of report.dropped) console.log(`    ✗ ${d.claim_id}: ${d.drop_reason}`);
console.log(`  ${report.surviving_count} surviving claims → Judgments anchored to the chain`);
console.log(`  provenance chain: ${report.chain_verified ? "VERIFIED" : "FAILED"} → ${outPath.replace(root + "/", "")}`);
