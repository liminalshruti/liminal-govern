/**
 * analyze() — deterministic seat-utilization audit.
 *
 * Loads a spend fixture and its seat-activity fixture, joins on row_id, and RECOMPUTES utilization
 * from raw active-seat counts (never an assumed/utilization column). Under-utilized vendors below
 * the health threshold each yield one SavingsFinding that cites its source row, states the
 * recomputed utilization, recommends a rightsizing action, and quantifies the monthly saving from
 * the idle seats. The per-finding savings sum to the headline total the report reconciles against.
 *
 * Pure + deterministic: same fixtures → byte-identical findings and total, every run.
 */

import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { readCsv } from "./csv.js";
import type { SavingsFinding } from "./provenance.js";
import type {
  AnalysisReport,
  SeatRow,
  SpendRow,
  UsageEvent,
  UtilizationRow,
} from "./types.js";

/** A vendor at or above this 30-day seat-utilization is considered healthy → no finding. */
export const HEALTH_THRESHOLD_PCT = 70;
/** Below this, the recommendation escalates from "rightsize" to "downgrade or cancel". */
export const CANCEL_THRESHOLD_PCT = 40;

const DATA_DIR = fileURLToPath(new URL("../../data/", import.meta.url));

/** Known fixture pairs. A fixture name resolves to its spend + matching activity file. */
const FIXTURES: Record<string, { spend: string; activity: string; period: string }> = {
  "q2-spend": { spend: "q2-spend.csv", activity: "q2-seat-activity.csv", period: "2026-Q2" },
  "sample-spend": { spend: "sample-spend.csv", activity: "seat-activity.csv", period: "sample" },
};

export interface AnalyzeOptions {
  spendPath?: string;
  activityPath?: string;
  period?: string;
}

/** Round to cents — deterministic money math, no floating drift in the headline. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Round a percentage to one decimal. */
function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/**
 * Resolve a fixture argument (a known name like "q2-spend", a bare filename, or a path) into the
 * concrete spend + activity paths to load.
 */
export function resolveFixture(fixture?: string): { spendPath: string; activityPath: string; label: string } {
  const name = (fixture ?? "q2-spend").replace(/\.csv$/i, "");
  const known = FIXTURES[name];
  if (known) {
    return { spendPath: DATA_DIR + known.spend, activityPath: DATA_DIR + known.activity, label: name };
  }
  // Treat as a path to a spend CSV; infer the activity sibling by convention.
  if (existsSync(fixture!)) {
    const activity = fixture!.includes("q2") ? "q2-seat-activity.csv" : "seat-activity.csv";
    const dir = fixture!.replace(/[^/]*$/, "");
    return { spendPath: fixture!, activityPath: dir + activity, label: name };
  }
  throw new Error(`analyze: unknown fixture "${fixture}". Known: ${Object.keys(FIXTURES).join(", ")}`);
}

function loadSpend(path: string): SpendRow[] {
  return readCsv(path).map((r) => ({
    row_id: r.row_id!,
    vendor: r.vendor!,
    plan: r.plan!,
    seats_purchased: Number(r.seats_purchased),
    monthly_cost: Number(r.monthly_cost),
    contract_term: r.contract_term,
  }));
}

function loadActivity(path: string): SeatRow[] {
  return readCsv(path).map((r) => ({
    row_id: r.row_id!,
    vendor: r.vendor!,
    active_seats_30d: Number(r.active_seats_30d),
  }));
}

export function loadUsageEvents(path = DATA_DIR + "usage-events.csv"): UsageEvent[] {
  if (!existsSync(path)) return [];
  return readCsv(path).map((r) => ({
    event_id: r.event_id!,
    date: r.date!,
    employee: r.employee!,
    model: r.model!,
    task_category: r.task_category!,
    task_label: r.task_label!,
    est_cost_usd: Number(r.est_cost_usd),
  }));
}

/**
 * Run the audit. Returns a fully-evidenced report: every joined row's recomputed utilization, the
 * findings (one per under-utilized vendor), and the reconcile-target total.
 */
export function analyze(fixture?: string, opts: AnalyzeOptions = {}): AnalysisReport {
  const resolved = opts.spendPath
    ? { spendPath: opts.spendPath, activityPath: opts.activityPath!, label: opts.spendPath }
    : resolveFixture(fixture);

  const spend = loadSpend(resolved.spendPath);
  const activity = loadActivity(resolved.activityPath);
  const activityById = new Map(activity.map((a) => [a.row_id, a]));

  const utilization: UtilizationRow[] = [];
  const findings: SavingsFinding[] = [];

  for (const s of spend) {
    const act = activityById.get(s.row_id);
    if (!act) {
      throw new Error(`analyze: spend row ${s.row_id} (${s.vendor}) has no matching activity row — refusing to assume utilization`);
    }
    if (s.seats_purchased <= 0) {
      throw new Error(`analyze: spend row ${s.row_id} has non-positive seats_purchased`);
    }

    // Recompute utilization from raw active-seat count — never trust an assumed column.
    const utilizationPct = round1((act.active_seats_30d / s.seats_purchased) * 100);
    const perSeatCost = round2(s.monthly_cost / s.seats_purchased);
    const healthy = utilizationPct >= HEALTH_THRESHOLD_PCT;

    utilization.push({
      row_id: s.row_id,
      vendor: s.vendor,
      seats_purchased: s.seats_purchased,
      active_seats_30d: act.active_seats_30d,
      monthly_cost: s.monthly_cost,
      per_seat_cost: perSeatCost,
      utilization_pct: utilizationPct,
      healthy,
    });

    if (healthy) continue;

    const idleSeats = s.seats_purchased - act.active_seats_30d;
    // Savings computed from raw figures (not the rounded per-seat) so the total reconciles exactly.
    const monthlySavings = round2((idleSeats / s.seats_purchased) * s.monthly_cost);

    const action =
      utilizationPct < CANCEL_THRESHOLD_PCT
        ? `Downgrade or cancel ${s.vendor}: only ${act.active_seats_30d}/${s.seats_purchased} seats active in 30d — drop ${idleSeats} idle seats`
        : `Rightsize ${s.vendor} from ${s.seats_purchased} to ${act.active_seats_30d} seats (active in 30d) — drop ${idleSeats} idle seats`;

    findings.push({
      finding_id: `F-${s.row_id}`,
      source_row_ids: [s.row_id],
      vendor: s.vendor,
      utilization_pct: utilizationPct,
      recommended_action: action,
      monthly_savings: monthlySavings,
    });
  }

  // Stable order: by row_id (findings) — deterministic regardless of input ordering.
  findings.sort((a, b) => (a.source_row_ids[0]! < b.source_row_ids[0]! ? -1 : 1));

  const total = round2(findings.reduce((acc, f) => acc + f.monthly_savings, 0));

  return {
    fixture: resolved.label,
    generated_for: opts.period ?? "2026-Q2",
    rows_analyzed: spend.length,
    utilization,
    findings,
    monthly_savings_total: total,
  };
}
