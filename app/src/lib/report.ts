/**
 * report.ts — consumes the orchestration lane's (S4) out/report.json.
 *
 * This is the REAL artifact emitted by `.claude/workflows/spend-audit.mjs` — the
 * 8-agent deliberation + adversarial reviewer + the real provenance chain. It is
 * vendored verbatim into public/data/report.json (from build-day/s4-orchestration).
 * When S4 merges to main, drop its out/report.json in unchanged — no edits here.
 *
 * The `provenance.anchored` block is the REAL provenance/ lib output (real SHA-256
 * packet hashes, hash-linked, chain_verified). The cockpit reads its chain from here.
 */

export interface OkrObjective {
  id: string;
  name: string;
  allocation: number;
  key_results: string[];
  tracking_streams: string[];
  aligned_task_categories: string[];
}

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
  type: "agent_fit_routing" | "okr_misalignment" | string;
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

export interface AnchoredEntry {
  packet_id: string;
  packet_hash: string;
  prev_hash: string | null;
  anchor_chain: string;
  anchor_network: string;
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

export interface Report {
  generated_for: string;
  okr_baseline: {
    budget_period: string;
    approved_model: string;
    cohort: string[];
    objectives: OkrObjective[];
  };
  classified_usage: ClassifiedUsage[];
  misalignment: {
    security_actual_pct: number;
    security_target_pct: number;
    delta_pct: number;
    governed_model: string;
    opus_total_usd: number;
  };
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

let reportPromise: Promise<Report> | null = null;

export async function loadReport(): Promise<Report> {
  if (!reportPromise) {
    reportPromise = fetch(`${import.meta.env.BASE_URL}data/report.json`).then((r) => {
      if (!r.ok) throw new Error(`report ${r.status}`);
      return r.json() as Promise<Report>;
    });
  }
  return reportPromise;
}
