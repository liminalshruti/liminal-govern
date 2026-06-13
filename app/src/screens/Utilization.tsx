import { PageHeader } from "../components/Page";
import { pct, usd, utilBand } from "../lib/format";
import { useSpendData } from "../lib/useSpendData";

// Seat-vs-activity: purchased seats vs. active-30d, with recomputed utilization.
export function Utilization() {
  const { data, loading } = useSpendData();

  return (
    <>
      <PageHeader
        title="Seat vs. activity utilization"
        sub="Purchased seats against active seats (30d). Utilization is recomputed from raw counts, not assumed."
      />
      {loading || !data ? (
        <p>Loading fixtures…</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th className="num">Purchased</th>
                <th className="num">Active 30d</th>
                <th className="num">Utilization</th>
                <th style={{ width: 140 }}>&nbsp;</th>
                <th className="num">$/active seat</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const band = utilBand(r.utilization_pct);
                return (
                  <tr key={r.row_id}>
                    <td>{r.vendor}</td>
                    <td className="num">{r.seats_purchased}</td>
                    <td className="num">{r.active_seats_30d}</td>
                    <td className="num">{pct(r.utilization_pct)}</td>
                    <td>
                      <div className={`bar ${band === "high" ? "" : band}`}>
                        <span style={{ width: `${Math.min(100, r.utilization_pct)}%` }} />
                      </div>
                    </td>
                    <td className="num">{usd(r.cost_per_active_seat)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
