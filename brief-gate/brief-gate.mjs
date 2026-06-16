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
import { pickReviewer, mockReviewer } from "./reviewer.mjs";
import { pickExtractor, parserExtractor } from "./extractor.mjs";
import { seal } from "./seal.mjs";
import { recordSeal, findPriorJudgments } from "./vault.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const briefPath = process.argv[2] || join(__dirname, "data/sample-brief.md");
const evidencePath = process.argv[3] || join(__dirname, "data/evidence.json");
const outPath = process.argv[4] || join(__dirname, "out/report.json");

// ── 1 · ingest ────────────────────────────────────────────────────────────────────────────────
const briefText = readFileSync(briefPath, "utf8");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));

// ── 2 · extract candidate claims (M4 seam): live AI for free-form briefs, OR deterministic parser ─
// The extractor changes HOW claims are pulled — never the downstream loop. Live (Opus 4.8) when
// ANTHROPIC_API_KEY is set (handles free-form prose); deterministic parser otherwise (the test path,
// no model round-trip). BRIEF_GATE_EXTRACTOR=parser forces deterministic.
const forceParser = process.env.BRIEF_GATE_EXTRACTOR === "parser";
const extractor = pickExtractor(forceParser ? parserExtractor : undefined);
const extractorMode = extractor === parserExtractor ? "deterministic (parser)" : "live (claude-opus-4-8)";
const claims = await extractor(briefText);

// ── 3 · adversarial review (M2 seam): drop claims contradicted by evidence ──────────────────────
// THE REVIEWER IS PLUGGABLE — live Opus 4.8 (demo) OR deterministic mock (test). It changes HOW the
// survives/drops decision is made, NEVER WHETHER the boundary below holds. Both return the same
// verdict shape { survives, refuted_by?, reason }. Selection: live if ANTHROPIC_API_KEY is set, else
// the deterministic mock — so the acceptance test passes with no model round-trip.
// `reviewer` can be injected (tests force mockReviewer; the demo can force liveReviewer).
const forceMock = process.env.BRIEF_GATE_REVIEWER === "mock";
const reviewer = pickReviewer(forceMock ? mockReviewer : undefined);
const reviewerMode = reviewer === mockReviewer ? "deterministic" : "live (claude-opus-4-8)";
const prEvidence = evidence.pr_evidence || [];
for (const c of claims) {
  const verdict = await reviewer(c, prEvidence); // ← await: liveReviewer is async (mock awaits fine)
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

// ── 4b · M4 re-entry: surface prior Judgments this brief's claims reference ──────────────────────
// The vault compounds: a new brief can re-enter a Judgment ratified in a PRIOR brief ("this was
// ruled on last month"). M4 reads the persistent vault and matches surviving claims to prior seals.
const vaultPath = process.argv[6] || join(__dirname, "out/vault.json");
const reEntries = findPriorJudgments(vaultPath, judgments);

// ── 5 · emit the report (deterministic) ─────────────────────────────────────────────────────────
const briefName = (briefPath.split("/").pop()) || "brief.md";
const dropped = claims.filter((c) => c.state === "dropped");
const report = {
  brief: briefName,
  extractor_mode: extractorMode,
  reviewer_mode: reviewerMode,
  re_entries: reEntries, // prior Judgments this brief references (the vault compounding)
  total_claims: claims.length,
  surviving_count: judgments.length,
  dropped_count: dropped.length,
  judgments: judgments.map((j) => ({ claim_id: j.claim_id, text: j.text, packet_hash: j.packet_hash })),
  dropped: dropped.map((c) => ({ claim_id: c.id, text: c.text, drop_reason: c.verdict.reason })),
  // The marquee M1 fact: the gate caught a weak claim and refused to anchor it.
  self_catch: dropped.length > 0 ? dropped[0].verdict.reason : null,
  chain_verified: log.verifyChain().ok,
};
log.close();

// ── 5b · M3: per-claim ratification + seal/export (fail-closed) ──────────────────────────────────
// The surviving (corrected) Judgments are still only DRAFT. They become operational only after the
// user ratifies them per-claim. Dispositions come from the ratification UI (a later milestone);
// here they're loaded from a file. THE BOUNDARY (deepened): exportable ONLY IF every Judgment is
// ratify/amend/defer — a 'pending' (un-decided) Judgment blocks export entirely.
const dispositionsPath = process.argv[5] || join(__dirname, "data/dispositions.json");
let sealResult = { exportable: false, blocked_reason: "no dispositions provided — all Judgments pending", summary: null, ratified_brief: null };
// Load dispositions if present + parseable. A missing/empty/bad file → no dispositions (every
// Judgment stays pending → not exportable). Fail-safe, never crash — and the gate stays closed.
let dispositions = [];
if (existsSync(dispositionsPath)) {
  try {
    const raw = readFileSync(dispositionsPath, "utf8").trim();
    if (raw) dispositions = JSON.parse(raw).dispositions || [];
  } catch {
    dispositions = []; // unparseable → no dispositions → fail closed (not exportable)
  }
}
sealResult = seal(report, dispositions);
report.ratification = {
  exportable: sealResult.exportable,
  blocked_reason: sealResult.blocked_reason,
  summary: sealResult.summary,
  ratified_brief: sealResult.ratified_brief, // null unless exportable
};

// ── 5c · M4 vault: record the sealed brief so future briefs can re-enter its Judgments ───────────
// Only an EXPORTABLE (fully-ratified) brief enters the vault — the boundary again: nothing
// un-ratified compounds into the trusted record. Set BRIEF_GATE_NO_VAULT=1 to skip (tests).
if (sealResult.exportable && process.env.BRIEF_GATE_NO_VAULT !== "1") {
  recordSeal(vaultPath, sealResult.ratified_brief, { briefName, sealedAt: sealResult.ratified_brief.sealed_at });
  report.vault_recorded = true;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");

// ── 6 · console summary ─────────────────────────────────────────────────────────────────────────
console.log(`brief-gate: ${briefPath.replace(root + "/", "")}  ·  extractor: ${extractorMode}  ·  reviewer: ${reviewerMode}`);
console.log(`  extracted ${report.total_claims} claims`);
for (const re of report.re_entries)
  console.log(`  ↩ re-entry: ${re.claim_id} references a prior Judgment (${re.prior.prior_claim_id} from ${re.prior.from_brief}, ${re.prior.disposition})`);
console.log(`  adversarial review dropped ${report.dropped_count}: ${report.self_catch ? "✓ self-catch" : "(none)"}`);
for (const d of report.dropped) console.log(`    ✗ ${d.claim_id}: ${d.drop_reason}`);
console.log(`  ${report.surviving_count} surviving claims → Judgments anchored to the chain`);
console.log(`  provenance chain: ${report.chain_verified ? "VERIFIED" : "FAILED"}`);
const r = report.ratification;
if (r.exportable) {
  console.log(`  ratification: ${r.summary.sealable} Judgments ratified → ✓ SEALED, exportable (sig ${r.ratified_brief.signature.slice(0, 12)}…)`);
} else {
  console.log(`  ratification: ✗ NOT exportable — ${r.blocked_reason}`);
}
console.log(`  → ${outPath.replace(root + "/", "")}`);
