import { useEffect, useState } from "react";
import { PageHeader } from "../components/Page";
import { shortHash, usd } from "../lib/format";
import { engineReport, getRatification, verifyChain } from "../lib/provenance";

// Governance state — all real, through the provenance seam: the ratified policy
// (anchored as the final chain entry), the chain-integrity walk (verifyChain), and
// the reconciliation that keeps the headline savings honest.
const RATIFY = getRatification();

export function Governance() {
  const [chain, setChain] = useState<Awaited<ReturnType<typeof verifyChain>> | null>(null);

  useEffect(() => {
    verifyChain().then(setChain);
  }, []);

  const recon = engineReport.reconcile;

  return (
    <>
      <PageHeader
        title="Governance state"
        sub="The ratified policy, the integrity of the finding chain, and the reconciliation that keeps the headline savings honest."
      />

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <span className="label">Chain integrity</span>
          <span className="value" style={{ color: chain?.ok ? "var(--good)" : "var(--bad)" }}>
            {chain ? (chain.ok ? "Verified" : "Broken") : "…"}
          </span>
          <span className="mono">{chain?.links.length ?? "…"} linked entries</span>
        </div>
        <div className="card stat">
          <span className="label">Reconciliation</span>
          <span className="value" style={{ color: recon.ok ? "var(--good)" : "var(--bad)" }}>
            {recon.ok ? "Balanced" : "Off"}
          </span>
          <span className="mono">sum {usd(recon.sum)} = total {usd(recon.total)} (Δ {usd(recon.delta)})</span>
        </div>
        <div className="card stat">
          <span className="label">Verified savings</span>
          <span className="value" style={{ color: "var(--good)" }}>{usd(engineReport.monthly_savings_total)}/mo</span>
          <span className="mono">surviving findings only</span>
        </div>
      </div>

      {/* Ratified policy */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Ratified policy</h2>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>{RATIFY.decision}</div>
        <p style={{ color: "var(--muted)", margin: "0 0 12px", fontSize: 14 }}>{RATIFY.rationale}</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div className="mono" style={{ marginBottom: 4 }}>Opus 4.8 allowed for</div>
            {RATIFY.agent_policy.opus_4_8_allowed_for.map((c) => (
              <span key={c} className="badge good" style={{ marginRight: 6 }}>{c}</span>
            ))}
          </div>
          <div>
            <div className="mono" style={{ marginBottom: 4 }}>Opus 4.8 disallowed for</div>
            {RATIFY.agent_policy.opus_4_8_disallowed_for.map((c) => (
              <span key={c} className="badge warn" style={{ marginRight: 6 }}>{c}</span>
            ))}
          </div>
        </div>
        <div className="receipt mono">
          <span>packet_id: {RATIFY.packet_id}</span>
          <span>packet_hash: {shortHash(RATIFY.receipt?.packet_hash)}</span>
          <span>anchor: {RATIFY.receipt?.anchor_chain} · {RATIFY.receipt?.anchor_network} · approved by {RATIFY.approved_by}</span>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Chain verification (per entry)</h2>
        {!chain ? (
          <p>Verifying…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Entry</th>
                <th>Hash-link</th>
              </tr>
            </thead>
            <tbody>
              {chain.links.map((l) => (
                <tr key={l.packet_id}>
                  <td className="mono">{l.packet_id}</td>
                  <td>
                    <span className={`badge ${l.ok ? "good" : "warn"}`}>{l.ok ? "linked" : "break"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
