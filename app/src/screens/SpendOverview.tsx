import { PageHeader } from "../components/Page";
import { usd, pct } from "../lib/format";
import { reportSummary } from "../lib/provenance";
import { REPORT, spendByCategory, totalClassifiedSpend } from "../lib/report";

const CATEGORY_LABEL: Record<string, string> = {
  product_dev: "Product development",
  security_hardening: "Security hardening",
  architecture_review: "Architecture review",
  calendar_admin: "Calendar / admin",
  summarization: "Summarization",
  unclassified: "Unclassified",
};

const OBJ_LABEL: Record<string, string> = Object.fromEntries(
  REPORT.okr_baseline.objectives.map((o) => [o.id, o.name]),
);

// Beat 1 — where the money goes. Opus 4.8 spend, classified against the OKRs.
export function SpendOverview() {
  const s = reportSummary;
  const rows = spendByCategory();
  const total = totalClassifiedSpend();
  const securityActual = Math.round(s.security_actual_pct * 100);
  const securityTarget = Math.round(s.security_target_pct * 100);

  return (
    <>
      <PageHeader
        title="Spend overview"
        sub={`Every Opus 4.8 call this period, classified against the team's OKRs. Source of truth: out/report.json (${REPORT.generated_for}).`}
      />

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <span className="label">Opus 4.8 spend · {s.period}</span>
          <span className="value">{usd(s.opus_total_usd)}</span>
        </div>
        <div className="card stat">
          <span className="label">Cohort · classified events</span>
          <span className="value">
            {s.cohort_size}
            <small style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}>
              {" "}/ {s.events} events
            </small>
          </span>
        </div>
        <div className="card stat">
          <span className="label">Ratified savings</span>
          <span className="value" style={{ color: "var(--good)" }}>
            {usd(s.ratified_savings)}/mo
          </span>
        </div>
      </div>

      {/* OKR alignment callout — the governance lens, not a seat ledger. */}
      <div className="card okr-callout" style={{ marginBottom: 20 }}>
        <div>
          <span className="label">Security hardening allocation</span>
          <p style={{ margin: "4px 0 0" }}>
            <strong>{securityActual}% actual</strong> vs{" "}
            <strong>{securityTarget}% target</strong> — Opus 4.8 spend is drifting off
            the security objective (O2).
          </p>
        </div>
        <div className="okr-bar">
          <div className="okr-track">
            <span className="okr-fill" style={{ width: `${securityActual}%` }} />
            <span className="okr-target" style={{ left: `${securityTarget}%` }} />
          </div>
          <span className="mono">target {securityTarget}%</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Objective</th>
              <th className="num">Events</th>
              <th className="num">Monthly spend</th>
              <th className="num">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category}>
                <td>
                  <strong>{CATEGORY_LABEL[r.category] ?? r.category}</strong>
                </td>
                <td>
                  {r.on_objective ? (
                    <span className="badge good">
                      {r.objective_id} · {OBJ_LABEL[r.objective_id ?? ""] ?? "on-objective"}
                    </span>
                  ) : (
                    <span className="badge warn">off-objective</span>
                  )}
                </td>
                <td className="num">{r.events}</td>
                <td className="num">{usd(r.total_usd)}</td>
                <td className="num mono">{pct(Math.round((r.total_usd / total) * 100))}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={{ fontWeight: 700 }}>
                Total classified spend
              </td>
              <td className="num" style={{ fontWeight: 700 }}>
                {usd(total)}
              </td>
              <td className="num mono">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
