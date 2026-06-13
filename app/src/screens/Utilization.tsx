import { PageHeader } from "../components/Page";
import { usd } from "../lib/format";
import { categorySpend, engineReport, okrData } from "../lib/provenance";

// OKR alignment: Opus 4.8 spend mapped to the ratified objectives (product 60% /
// security 40%). The S4 finding: security hardening is under-allocated (24% vs
// 40% target). Replaces the legacy SaaS seat-vs-activity view.
const CAT_TO_OBJ: Record<string, string> = {
  product_dev: "O1",
  architecture_review: "O1",
  security_hardening: "O2",
};

export function Utilization() {
  const opus = engineReport.opus_total;

  // Spend per objective from the category mix.
  const perObjective = okrData.objectives.map((o) => {
    const usdSpent = categorySpend
      .filter((c) => CAT_TO_OBJ[c.category] === o.id)
      .reduce((s, c) => s + c.usd, 0);
    const actualPct = Math.round((usdSpent / opus) * 1000) / 10;
    const targetPct = Math.round(o.target_pct * 100);
    return { ...o, usdSpent, actualPct, targetPct, gap: actualPct - targetPct };
  });

  // Spend not aligned to any objective (calendar/summarization/unclassified) = candidate waste.
  const aligned = new Set(Object.keys(CAT_TO_OBJ));
  const misaligned = categorySpend.filter((c) => !aligned.has(c.category));
  const misalignedUsd = misaligned.reduce((s, c) => s + c.usd, 0);

  return (
    <>
      <PageHeader
        title="OKR alignment"
        sub="Opus 4.8 spend mapped to the ratified objectives. The finding: security hardening is under-allocated against its 40% target."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Objective</th>
              <th className="num">Spend / mo</th>
              <th className="num">Actual %</th>
              <th className="num">Target %</th>
              <th>Alignment</th>
            </tr>
          </thead>
          <tbody>
            {perObjective.map((o) => (
              <tr key={o.id}>
                <td>{o.id} · {o.name}</td>
                <td className="num">{usd(o.usdSpent)}</td>
                <td className="num">{o.actualPct}%</td>
                <td className="num">{o.targetPct}%</td>
                <td>
                  <span className={`badge ${Math.abs(o.gap) <= 5 ? "good" : "warn"}`}>
                    {o.gap >= 0 ? "+" : ""}{o.gap.toFixed(0)} pts {o.gap < -5 ? "under" : o.gap > 5 ? "over" : "on target"}
                  </span>
                </td>
              </tr>
            ))}
            <tr>
              <td>Unaligned (calendar / summarization / unclassified)</td>
              <td className="num">{usd(misalignedUsd)}</td>
              <td className="num">{Math.round((misalignedUsd / opus) * 1000) / 10}%</td>
              <td className="num">0%</td>
              <td><span className="badge warn">candidate waste</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="page-sub" style={{ margin: 0 }}>
        Security hardening sits at {Math.round(okrData.security_actual_pct * 100)}% of Opus spend vs a{" "}
        {Math.round(okrData.security_target_pct * 100)}% target — the S4 reallocation finding.
      </p>
    </>
  );
}
