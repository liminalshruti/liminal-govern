import { PageHeader } from "../components/Page";
import { usd } from "../lib/format";
import { useSpendData } from "../lib/useSpendData";

// Renders real fixture data: per-vendor monthly spend + reconciled total.
export function SpendOverview() {
  const { data, loading } = useSpendData();

  return (
    <>
      <PageHeader
        title="Spend overview"
        sub="Seeded Q2 software + AI spend (synthetic fixture). Reconciles to a monthly total."
      />
      {loading || !data ? (
        <p>Loading fixtures…</p>
      ) : (
        <>
          <div className="grid cols-3" style={{ marginBottom: 20 }}>
            <div className="card stat">
              <span className="label">Monthly spend</span>
              <span className="value">{usd(data.totalSpend)}</span>
            </div>
            <div className="card stat">
              <span className="label">Vendors</span>
              <span className="value">{data.spend.length}</span>
            </div>
            <div className="card stat">
              <span className="label">Identified savings</span>
              <span className="value" style={{ color: "var(--good)" }}>
                {usd(data.totalSavings)}/mo
              </span>
            </div>
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Plan</th>
                  <th className="num">Seats</th>
                  <th className="num">Monthly cost</th>
                </tr>
              </thead>
              <tbody>
                {data.spend.map((s) => (
                  <tr key={s.row_id}>
                    <td>{s.vendor}</td>
                    <td>{s.plan}</td>
                    <td className="num">{s.seats_purchased}</td>
                    <td className="num">{usd(s.monthly_cost)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ fontWeight: 700 }}>
                    Total
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {usd(data.totalSpend)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
