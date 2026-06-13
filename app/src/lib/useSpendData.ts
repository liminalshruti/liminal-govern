import { useEffect, useState } from "react";
import type { SavingsFinding, SpendLineItem } from "./contract";
import {
  deriveFindings,
  loadSeatActivity,
  loadSpend,
  reconcileUtilization,
  totalMonthlySavings,
  totalMonthlySpend,
  type UtilizationRow,
} from "./fixtures";

export interface SpendData {
  spend: SpendLineItem[];
  rows: UtilizationRow[];
  findings: SavingsFinding[];
  totalSpend: number;
  totalSavings: number;
}

/** Loads + reconciles the fixtures once. Shared by the spend / utilization screens. */
export function useSpendData(): { data: SpendData | null; loading: boolean } {
  const [data, setData] = useState<SpendData | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadSpend(), loadSeatActivity()]).then(([spend, activity]) => {
      if (!live) return;
      const rows = reconcileUtilization(spend, activity);
      const findings = deriveFindings(rows);
      setData({
        spend,
        rows,
        findings,
        totalSpend: totalMonthlySpend(spend),
        totalSavings: totalMonthlySavings(findings),
      });
    });
    return () => {
      live = false;
    };
  }, []);

  return { data, loading: data === null };
}
