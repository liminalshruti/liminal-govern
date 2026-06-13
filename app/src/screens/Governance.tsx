import { useEffect, useState } from "react";
import { PageHeader, StubBanner } from "../components/Page";
import { usd } from "../lib/format";
import { verifyChain } from "../lib/provenance";

// Ratified-cap / governance state. The ratified cap is a stub value; the chain
// verification IS wired through the provenance seam (verifyChain).
const RATIFIED_CAP = 12000; // USD/mo — placeholder until S4 ratification flow lands

export function Governance() {
  const [chain, setChain] = useState<Awaited<ReturnType<typeof verifyChain>> | null>(null);

  useEffect(() => {
    verifyChain().then(setChain);
  }, []);

  return (
    <>
      <PageHeader
        title="Governance state"
        sub="The ratified monthly cap and the integrity of the finding chain."
      />
      <StubBanner>
        Ratified cap is a placeholder. The S4 ratification workflow (lane A) sets it; the
        chain verification below is wired through the provenance seam.
      </StubBanner>

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <span className="label">Ratified cap</span>
          <span className="value">{usd(RATIFIED_CAP)}/mo</span>
        </div>
        <div className="card stat">
          <span className="label">Chain integrity</span>
          <span className="value" style={{ color: chain?.ok ? "var(--good)" : "var(--bad)" }}>
            {chain ? (chain.ok ? "Verified" : "Broken") : "…"}
          </span>
        </div>
        <div className="card stat">
          <span className="label">Linked entries</span>
          <span className="value">{chain?.links.length ?? "…"}</span>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Chain verification (per finding)</h2>
        {!chain ? (
          <p>Verifying…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Finding</th>
                <th>Hash-link</th>
              </tr>
            </thead>
            <tbody>
              {chain.links.map((l) => (
                <tr key={l.packet_id}>
                  <td className="mono">{l.packet_id}</td>
                  <td>
                    <span className={`badge ${l.ok ? "good" : "warn"}`}>
                      {l.ok ? "linked" : "break"}
                    </span>
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
