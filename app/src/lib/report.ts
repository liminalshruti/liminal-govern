/**
 * report.ts — SINGLE SOURCE OF TRUTH for the cockpit (Build Day 2026-06-13).
 *
 * The cockpit reads the SAME artifact the S4 deliberation workflow and the PITCH
 * use: the engine's `out/report.json`. It is baked into the bundle at build time by
 * `scripts/prebuild.mjs` (copies `../out/report.json` → `src/generated/report.json`),
 * so the numbers on screen are byte-identical to the numbers in the deck.
 *
 * This is AI-spend GOVERNANCE, not a seat-utilization dashboard: Opus 4.8 usage is
 * classified against the team's OKRs, off-objective work is routed to registry-verified
 * lower-cost agents, every finding cites its evidence rows + carries a provenance anchor,
 * and one claim (E14 → $162) was REFUTED by adversarial review (PR-103) and dropped.
 *
 * Components never import this file's raw shape directly — they go through
 * src/lib/provenance.ts (the stable data seam). This module only types + loads it.
 */

import reportJson from "../generated/report.json";

// ───────────────────────────── report.json shape ─────────────────────────────

export type FindingType = "agent_fit_routing" | "okr_misalignment";

export interface ClassifiedUsage {
  event_id: string;
  model: string;
  category: string;
  objective_id: string | null;
  est_cost_usd: number;
  source_row: string;
}

export interface ReportFinding {
  finding_id: string;
  type: FindingType;
  category?: string;
  employee?: string;
  recommended_action: string;
  approved_alternative?: string;
  approved_alternative_id?: string;
  monthly_savings: number;
  source_row_ids: string[];
  dropped?: boolean;
  drop_reason?: string;
}

export interface Misalignment {
  security_actual_pct: number;
  security_target_pct: number;
  delta_pct: number;
  governed_model: string;
  opus_total_usd: number;
}

export interface RatifiedDecision {
  decision: string;
  rationale: string;
  approved_alternative: string;
  approved_by: string;
  effective_period: string;
  referenced_context: string[];
  agent_policy: {
    opus_4_8_allowed_for: string[];
    opus_4_8_disallowed_for: string[];
  };
}

export interface AnchoredEntry {
  packet_id: string;
  packet_hash: string;
  prev_hash: string | null;
  anchor_chain: string;
  anchor_network: string;
}

export interface Report {
  generated_for: string;
  okr_baseline: {
    budget_period: string;
    approved_model: string;
    cohort: string[];
    objectives: {
      id: string;
      name: string;
      allocation: number;
      key_results: string[];
      tracking_streams: string[];
      aligned_task_categories: string[];
    }[];
  };
  classified_usage: ClassifiedUsage[];
  misalignment: Misalignment;
  findings: ReportFinding[];
  ratified_decision: RatifiedDecision;
  total_recommended_savings: number;
  naive_savings: number;
  dropped_claims: { finding_id: string; drop_reason: string }[];
  provenance: {
    chain_verified: boolean;
    chain_length: number;
    anchored: AnchoredEntry[];
    db: string;
  };
  report_citations: string[];
}

/** The baked engine report — the one source of truth for every screen. */
export const REPORT = reportJson as unknown as Report;

// ───────────────────────────── derived accessors ─────────────────────────────

const usageById = new Map(REPORT.classified_usage.map((u) => [u.event_id, u]));

/** Resolve a finding's cited evidence rows (E-codes) to classified usage events. */
export function evidenceFor(rowIds: string[]): ClassifiedUsage[] {
  return rowIds.map((id) => usageById.get(id)).filter((u): u is ClassifiedUsage => Boolean(u));
}

/** Findings still standing (anchored) — exclude any refuted/dropped claim. */
export function liveFindings(): ReportFinding[] {
  return REPORT.findings.filter((f) => !f.dropped);
}

/** Claims refuted by adversarial review and dropped from the chain (e.g. E14). */
export function droppedFindings(): ReportFinding[] {
  return REPORT.findings.filter((f) => f.dropped);
}

/** Opus 4.8 spend grouped by category, with objective alignment + share of total. */
export interface CategorySpend {
  category: string;
  objective_id: string | null;
  total_usd: number;
  events: number;
  on_objective: boolean;
}

export function spendByCategory(): CategorySpend[] {
  const byCat = new Map<string, CategorySpend>();
  for (const u of REPORT.classified_usage) {
    const existing = byCat.get(u.category);
    if (existing) {
      existing.total_usd += u.est_cost_usd;
      existing.events += 1;
    } else {
      byCat.set(u.category, {
        category: u.category,
        objective_id: u.objective_id,
        total_usd: u.est_cost_usd,
        events: 1,
        on_objective: u.objective_id !== null,
      });
    }
  }
  return [...byCat.values()].sort((a, b) => b.total_usd - a.total_usd);
}

/** Total classified Opus + Haiku spend across the cohort this period. */
export function totalClassifiedSpend(): number {
  return REPORT.classified_usage.reduce((s, u) => s + u.est_cost_usd, 0);
}

/** Headline figures, straight from the report (what the pitch quotes). */
export const headline = {
  period: REPORT.okr_baseline.budget_period,
  approved_model: REPORT.okr_baseline.approved_model,
  opus_total_usd: REPORT.misalignment.opus_total_usd,
  ratified_savings: REPORT.total_recommended_savings,
  naive_savings: REPORT.naive_savings,
  dropped_usd: REPORT.naive_savings - REPORT.total_recommended_savings,
  security_actual_pct: REPORT.misalignment.security_actual_pct,
  security_target_pct: REPORT.misalignment.security_target_pct,
  cohort_size: REPORT.okr_baseline.cohort.length,
  events: REPORT.classified_usage.length,
};
