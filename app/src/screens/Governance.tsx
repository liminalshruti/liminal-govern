import { useEffect, useState } from "react";
import { PageHeader } from "../components/Page";
import { shortHash, usd } from "../lib/format";
import { getRatification, getReconcile, verifyChain } from "../lib/provenance";

type Verify = Awaited<ReturnType<typeof verifyChain>>;
type Reconcile = Awaited<ReturnType<typeof getReconcile>>;
type Ratification = Awaited<ReturnType<typeof getRatification>>;

// Governance state — all real, through the provenance seam: the ratified policy,
// the chain-integrity walk (verifyChain), and the reconciliation check (the sum
// of surviving findings must equal the report total ±$1).
export function Governance() {
  const [chain, setChain] = useState<Verify | null>(null);
  const [recon, setRecon] = useState<Reconcile | null>(null);
  const [ratification, setRatification] = useState<Ratification | null>(null);

  useEffect(() => {
    verifyChain().then(setChain);
    getReconcile().then(setRecon);
    getRatification().then(setRatification);
  }, []);

  return (
    <>
      <PageHeader
        title="Governance state"
        sub="The ratified policy, the integrity of the finding chain, and the reconciliation that keeps the headline number honest."
      />

      <div className="grid cols-3" style={{ marginBottom: 22 }}>
        <div className="card stat">
          <span className="label">Chain integrity</span>
          <span className="value" style={{ color: chain?.ok ? "var(--good)" : "var(--bad)" }}>
            {chain ? (chain.ok ? "Verified" : "Broken") : "…"}
          </span>
          <span className="mono">{chain?.length ?? "…"} linked entries · brokenIndex {chain?.brokenIndex ?? "…"}</span>
        </div>
        <div className="card stat">
          <span className="label">Reconciliation</span>
          <span className="value" style={{ color: recon?.ok ? "var(--good)" : "var(--bad)" }}>
            {recon ? (recon.ok ? "Balanced" : "Off") : "…"}
          </span>
          <span className="mono">{recon ? `sum ${usd(recon.sum)} = total ${usd(recon.total)} (Δ ${usd(recon.delta)})` : "…"}</span>
        </div>
        <div className="card stat">
          <span className="label">Verified savings</span>
          <span className="value" style={{ color: "var(--good)" }}>{recon ? `${usd(recon.total)}/mo` : "…"}</span>
          <span className="mono">surviving findings only</span>
        </div>
      </div>

      {/* Ratified policy */}
      <div className="card" style={{ marginBottom: 18, borderColor: "#cdd2fb" }}>
        <h2 style={{ marginTop: 0 }}>Ratified policy</h2>
        <div className="ratify-policy" style={{ color: "var(--ink)", fontSize: 17 }}>
          {ratification?.policy ?? "—"}
        </div>
        <div className="receipt mono" style={{ marginTop: 10 }}>
          <span><span className="k">packet_id</span> {ratification?.id ?? "—"}</span>
          <span><span className="k">packet_hash</span> {shortHash(ratification?.packet_hash)}</span>
          <span className="full">
            <span className="k">anchor</span> {ratification?.receipt?.anchor_chain ?? "—"} · {ratification?.receipt?.anchor_network ?? "—"} · anchored {ratification?.receipt?.anchored_at?.slice(0, 10) ?? "—"}
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Chain entry</th>
              <th>Hash-link</th>
            </tr>
          </thead>
          <tbody>
            {chain?.links.map((l, i) => (
              <tr key={l.packet_id}>
                <td className="mono">{i}</td>
                <td className="mono">{l.packet_id}</td>
                <td>
                  <span className={`badge ${l.ok ? "good" : "bad"} dot`}>{l.ok ? "linked" : "break"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
