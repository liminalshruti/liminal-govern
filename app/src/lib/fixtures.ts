// fixtures.ts — loads the seeded spend/seat-activity CSVs and reconciles them
// into SavingsFindings. This is the FIXTURE backend behind the provenance seam.
//
// The CSVs ship in public/data/ (copied from repo-root data/*.csv). They are
// synthetic — no real customer names. Phase-3 replaces this whole module with
// the real provenance/ lib output; see src/lib/provenance.ts for the swap point.

import type {
  SavingsFinding,
  SeatActivity,
  SpendLineItem,
} from "./contract";

const SPEND_CSV = "/data/q2-spend.csv";
const SEAT_CSV = "/data/q2-seat-activity.csv";

/** Minimal CSV parser — header row + comma-split. Fixtures have no quoted commas. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

export async function loadSpend(): Promise<SpendLineItem[]> {
  const res = await fetch(SPEND_CSV);
  const rows = parseCsv(await res.text());
  return rows.map((r) => ({
    row_id: r.row_id,
    vendor: r.vendor,
    plan: r.plan,
    seats_purchased: Number(r.seats_purchased),
    monthly_cost: Number(r.monthly_cost),
  }));
}

export async function loadSeatActivity(): Promise<SeatActivity[]> {
  const res = await fetch(SEAT_CSV);
  const rows = parseCsv(await res.text());
  return rows.map((r) => ({
    row_id: r.row_id,
    vendor: r.vendor,
    active_seats_30d: Number(r.active_seats_30d),
  }));
}

export interface UtilizationRow extends SpendLineItem {
  active_seats_30d: number;
  utilization_pct: number; // recomputed, not assumed
  cost_per_active_seat: number;
}

/** Join spend ⋈ activity and recompute utilization from raw counts. */
export function reconcileUtilization(
  spend: SpendLineItem[],
  activity: SeatActivity[],
): UtilizationRow[] {
  const byRow = new Map(activity.map((a) => [a.row_id, a]));
  return spend.map((s) => {
    const active = byRow.get(s.row_id)?.active_seats_30d ?? 0;
    const utilization_pct =
      s.seats_purchased > 0
        ? Math.round((active / s.seats_purchased) * 1000) / 10
        : 0;
    return {
      ...s,
      active_seats_30d: active,
      utilization_pct,
      cost_per_active_seat:
        active > 0
          ? Math.round((s.monthly_cost / active) * 100) / 100
          : s.monthly_cost,
    };
  });
}

// Utilization at or below this fraction triggers a downsize finding.
const UNDERUTILIZED_THRESHOLD = 0.6;

/**
 * Derive SavingsFindings from the reconciled rows. Each finding cites its
 * source row(s) by id and carries a recomputed utilization_pct. The recommended
 * action right-sizes seats to observed active usage; monthly_savings is the
 * reclaimed seat cost. Sum of monthly_savings is the report total.
 */
export function deriveFindings(rows: UtilizationRow[]): SavingsFinding[] {
  return rows
    .filter((r) => r.utilization_pct <= UNDERUTILIZED_THRESHOLD * 100)
    .map((r) => {
      const perSeat = r.seats_purchased > 0 ? r.monthly_cost / r.seats_purchased : 0;
      // Right-size to active usage (keep a 1-seat headroom buffer).
      const targetSeats = Math.min(r.seats_purchased, r.active_seats_30d + 1);
      const reclaimedSeats = Math.max(0, r.seats_purchased - targetSeats);
      const monthly_savings = Math.round(perSeat * reclaimedSeats);
      return {
        finding_id: `F-${r.row_id}`,
        source_row_ids: [r.row_id],
        vendor: r.vendor,
        utilization_pct: r.utilization_pct,
        recommended_action: `Downsize ${r.vendor} ${r.plan} from ${r.seats_purchased} to ${targetSeats} seats (active 30d: ${r.active_seats_30d}).`,
        monthly_savings,
      };
    })
    .filter((f) => f.monthly_savings > 0)
    .sort((a, b) => b.monthly_savings - a.monthly_savings);
}

export function totalMonthlySpend(spend: SpendLineItem[]): number {
  return spend.reduce((sum, s) => sum + s.monthly_cost, 0);
}

export function totalMonthlySavings(findings: SavingsFinding[]): number {
  return findings.reduce((sum, f) => sum + f.monthly_savings, 0);
}
