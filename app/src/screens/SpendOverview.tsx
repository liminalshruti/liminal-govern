import { PageHeader } from "../components/Page";
import { usd } from "../lib/format";
import { categorySpend, engineReport } from "../lib/provenance";

const CAT_LABEL: Record<string, string> = {
  product_dev: "Product development",
  security_hardening: "Security hardening",
  calendar_admin: "Calendar / admin",
  summarization: "Summarization",
  unclassified: "Unclassified",
};

// AI-spend overview: Opus 4.8 spend this period, broken down by task category,
// reconciled to the governed-model total. The verified realizable savings are the
// surviving-finding total ($284), not a SaaS-seat number.
export function SpendOverview() {
  return (
    <>
      <PageHeader
        title="AI spend overview"
        sub={`${engineReport.governed_model} usage for ${engineReport.generated_for}. Reconciles to the monthly governed-model total.`}
      />

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <span className="label">Opus 4.8 spend / mo</span>
          <span className="value">{usd(engineReport.opus_total)}</span>
        </div>
        <div className="card stat">
          <span className="label">Usage events</span>
          <span className="value">{engineReport.rows_analyzed}</span>
        </div>
        <div className="card stat">
          <span className="label">Verified savings</span>
          <span className="value" style={{ color: "var(--good)" }}>{usd(engineReport.monthly_savings_total)}/mo</span>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Task category</th>
              <th className="num">Spend / mo</th>
              <th className="num">% of Opus</th>
            </tr>
          </thead>
          <tbody>
            {categorySpend.map((c) => (
              <tr key={c.category}>
                <td>{CAT_LABEL[c.category] ?? c.category}</td>
                <td className="num">{usd(c.usd)}</td>
                <td className="num">{c.pct}%</td>
              </tr>
            ))}
            <tr>
              <td style={{ fontWeight: 700 }}>Total</td>
              <td className="num" style={{ fontWeight: 700 }}>{usd(engineReport.opus_total)}</td>
              <td className="num" style={{ fontWeight: 700 }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
