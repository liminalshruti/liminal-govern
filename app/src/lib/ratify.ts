/**
 * ratify.ts — the cockpit data-seam for the Brief Gate ratification UI.
 *
 * The Ratify screen imports ONLY from here. It loads a Brief Gate report (the M1/M2 output:
 * surviving Judgments + the dropped self-catch) and provides the client-side seal logic —
 * the SAME fail-closed rule as brief-gate/seal.mjs: a Ratified Brief is exportable ONLY IF every
 * Judgment is ratify/amend/defer. A 'pending' (un-decided) Judgment blocks export.
 *
 * The unit is a Judgment; the artifact is a Ratified Brief.
 */

export type Disposition = "pending" | "ratify" | "amend" | "drop" | "defer";

export interface BriefJudgment {
  claim_id: string;
  text: string;
  packet_hash: string;
}
export interface DroppedClaim {
  claim_id: string;
  text: string;
  drop_reason: string;
}
export interface BriefGateReport {
  brief: string;
  extractor_mode: string;
  reviewer_mode: string;
  judgments: BriefJudgment[];
  dropped: DroppedClaim[];
  self_catch: string | null;
}

/** A Judgment plus the operator's current disposition + (for amend) the corrected text. */
export interface RatifiableJudgment extends BriefJudgment {
  disposition: Disposition;
  amended_text?: string;
}

/** Dispositions that allow a Judgment into the sealed brief (mirrors seal.mjs RATIFYING). */
const RATIFYING: ReadonlySet<Disposition> = new Set(["ratify", "amend", "defer"]);

export async function loadBriefGateReport(): Promise<BriefGateReport> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/brief-gate-report.json`);
  if (!r.ok) throw new Error(`brief-gate-report.json ${r.status}`);
  return r.json();
}

/**
 * The fail-closed boundary, client-side (identical to seal.mjs):
 *   exportable ⇔ no Judgment is 'pending'. A 'drop' is excluded from the sealed brief but does
 *   NOT block export. A 'pending' (un-decided) Judgment blocks export entirely.
 */
export function computeSeal(judgments: RatifiableJudgment[]): {
  exportable: boolean;
  pending: string[];
  sealable: RatifiableJudgment[];
  blockedReason: string | null;
} {
  const pending = judgments.filter((j) => j.disposition === "pending").map((j) => j.claim_id);
  const sealable = judgments.filter((j) => RATIFYING.has(j.disposition));
  const exportable = pending.length === 0;
  return {
    exportable,
    pending,
    sealable,
    blockedReason: exportable
      ? null
      : `Cannot export — ${pending.length} claim(s) unratified: ${pending.join(", ")}. Every claim must be ratified, amended, deferred, or dropped before the brief can become operational.`,
  };
}

/** Build the sealed Ratified Brief payload (what export produces). */
export function buildRatifiedBrief(judgments: RatifiableJudgment[], briefName: string) {
  const { sealable } = computeSeal(judgments);
  return {
    brief: briefName,
    sealed: true,
    judgments: sealable.map((j) => ({
      claim_id: j.claim_id,
      disposition: j.disposition,
      text: j.disposition === "amend" && j.amended_text ? j.amended_text : j.text,
    })),
    corrections: judgments
      .filter((j) => j.disposition === "amend" && j.amended_text)
      .map((j) => ({ claim_id: j.claim_id, from: j.text, to: j.amended_text })),
  };
}
