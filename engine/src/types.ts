/**
 * Engine-local types. The cross-surface wire types (Packet / AnchorReceipt / SavingsFinding /
 * SpendLineItem / SeatActivity) come from the canonical contract via the provenance lib
 * (see ./provenance.ts). These types are the engine's INPUT rows and the enforcement-beat shapes,
 * which are not part of the shared wire contract.
 */

import type { SavingsFinding } from "./provenance.js";

/** A parsed spend row (q2-spend.csv / sample-spend.csv). Superset of the contract SpendLineItem. */
export interface SpendRow {
  row_id: string;
  vendor: string;
  plan: string;
  seats_purchased: number;
  monthly_cost: number;
  contract_term?: string;
}

/** A parsed seat-activity row (q2-seat-activity.csv / seat-activity.csv). */
export interface SeatRow {
  row_id: string;
  vendor: string;
  active_seats_30d: number;
}

/** A parsed usage-events row (usage-events.csv). Used for the model-mix cross-check. */
export interface UsageEvent {
  event_id: string;
  date: string;
  employee: string;
  model: string;
  task_category: string;
  task_label: string;
  est_cost_usd: number;
}

/**
 * The deterministic output of analyze(): findings that each cite their source rows, the headline
 * total they reconcile to, and a per-row utilization table so the math is inspectable.
 */
export interface AnalysisReport {
  fixture: string;
  generated_for: string;          // budget period label, derived from the join
  rows_analyzed: number;
  utilization: UtilizationRow[];   // every joined row, recomputed util
  findings: SavingsFinding[];      // only the under-utilized rows produce a finding
  monthly_savings_total: number;   // sum of findings[].monthly_savings (the reconcile target)
}

/** Per-row recomputed utilization — the evidence behind each finding. */
export interface UtilizationRow {
  row_id: string;
  vendor: string;
  seats_purchased: number;
  active_seats_30d: number;
  monthly_cost: number;
  per_seat_cost: number;
  utilization_pct: number;
  healthy: boolean;
}

// ─────────────────────── Enforcement beat (enforceCap) ───────────────────────

/** A spend decision presented to the enforcement agent for ratification or refusal. */
export interface SpendDecision {
  id: string;
  description: string;
  vendor?: string;
  amount: number;     // USD/month the decision would commit
  lane?: string;      // the governance lane this decision claims (e.g. "seat-rightsizing")
}

export type Verdict = "approve" | "refuse";

export type RefusalKind =
  | "over-cap"          // amount would breach the ratified monthly cap
  | "out-of-lane"       // not a spend decision the governance lane judges
  | "surveillance"      // targets people, not spend — refused on principle
  | "none";

/** The agent's bounded ruling on a single decision. */
export interface EnforcementVerdict {
  decision_id: string;
  verdict: Verdict;
  refusal_kind: RefusalKind;
  rationale: string;
  cap: number;
  amount: number;
  model: string;       // the model that issued the ruling
  source: "opus" | "deterministic-guard";
}
