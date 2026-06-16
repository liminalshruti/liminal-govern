// seal.mjs — Brief Gate M3: per-claim ratification + seal & export (fail-closed).
//
// Implements SPEC_BRIEF_GATE_V1 § M3. Completes the wedge: M1/M2 = CORRECTION (claims survive
// adversarial review); M3 = RATIFICATION (the user decides ratify/amend/drop/defer per claim) +
// the seal/export boundary.
//
// THE M3 BOUNDARY (the system law, deepened): survived-review is no longer enough to export. A
// Ratified Brief is exportable ONLY IF every included Judgment carries a disposition of
// ratify / amend / defer. A 'drop' is excluded. A Judgment with NO disposition is 'pending' and
// BLOCKS export. → unratified claims literally cannot enter the operational (sealed/exportable) brief.
//
// Inputs: the M1/M2 report (surviving Judgments) + a dispositions file (what the ratification UI
// will produce — UI is a later milestone; M3 proves the seal logic + the fail-closed gate).

import { createHash } from "node:crypto";

const RATIFYING = new Set(["ratify", "amend", "defer"]); // dispositions that allow a Judgment into the sealed brief

/**
 * Apply ratification dispositions to the surviving Judgments and seal a Ratified Brief.
 * @returns {{ ratified_brief, exportable, blocked_reason }}
 */
export function seal(report, dispositions, { sealedAt = "2026-06-15T00:00:00.000Z" } = {}) {
  const byClaim = new Map(dispositions.map((d) => [d.claim_id, d]));

  // Each surviving Judgment gets its disposition (or 'pending' if the user hasn't decided).
  const ratifiedJudgments = report.judgments.map((j) => {
    const d = byClaim.get(j.claim_id);
    const disposition = d?.disposition ?? "pending";
    return {
      claim_id: j.claim_id,
      disposition,
      // amend appends a correction (the amended text) — never overwrites the original Judgment.
      final_text: disposition === "amend" && d?.amended_text ? d.amended_text : j.text,
      original_text: j.text,
      packet_hash: j.packet_hash,
    };
  });

  // ── THE FAIL-CLOSED GATE ────────────────────────────────────────────────────────────────────
  // A Judgment is "sealable" only if its disposition is ratify/amend/defer. 'drop' is excluded
  // from the sealed brief; 'pending' (no decision) BLOCKS export entirely.
  const pending = ratifiedJudgments.filter((j) => j.disposition === "pending");
  const sealable = ratifiedJudgments.filter((j) => RATIFYING.has(j.disposition));
  const dropped = ratifiedJudgments.filter((j) => j.disposition === "drop");

  const exportable = pending.length === 0; // ← the boundary: any pending Judgment blocks export
  const blocked_reason = exportable
    ? null
    : `Cannot export: ${pending.length} Judgment(s) are unratified (pending): ${pending.map((j) => j.claim_id).join(", ")}. ` +
      `Every claim must be ratified/amended/deferred (or dropped) before the brief can become operational.`;

  // The sealed brief includes ONLY ratify/amend/defer Judgments; a signature over its content.
  const sealedContent = {
    sealed_at: sealedAt,
    judgments: sealable.map((j) => ({ claim_id: j.claim_id, disposition: j.disposition, text: j.final_text })),
  };
  const signature = createHash("sha256").update(JSON.stringify(sealedContent)).digest("hex");

  return {
    exportable,
    blocked_reason,
    ratified_brief: exportable
      ? {
          ...sealedContent,
          signature,
          // amendments are recorded as corrections (append-only), never silent overwrites:
          corrections: ratifiedJudgments
            .filter((j) => j.disposition === "amend")
            .map((j) => ({ claim_id: j.claim_id, from: j.original_text, to: j.final_text })),
        }
      : null,
    summary: {
      total_judgments: ratifiedJudgments.length,
      sealable: sealable.length,
      pending: pending.length,
      dropped_at_ratification: dropped.length,
    },
  };
}
