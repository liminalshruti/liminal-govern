import { useEffect, useState } from "react";
import { PageHeader } from "../components/Page";
import { usd } from "../lib/format";
import { reportSummary, verifyChain } from "../lib/provenance";
import { REPORT } from "../lib/report";

// Beat 4 — the ratified cap. A governance decision the swarm now refuses to cross,
// with the chain that proves it. Source of truth: out/report.json#ratified_decision.
export function Governance() {
  const [chain, setChain] = useState<Awaited<ReturnType<typeof verifyChain>> | null>(null);
  const d = REPORT.ratified_decision;
  const s = reportSummary;

  useEffect(() => {
    verifyChain().then(setChain);
  }, []);

  return (
    <>
      <PageHeader
        title="Governance & cap"
        sub="The ratified policy the agent swarm now enforces — and the hash-linked chain that proves it."
      />

      {/* ── The refusal — the centerpiece ── */}
      <div className="card refusal-card">
        <div className="refusal-flag">CAP RATIFIED · ENFORCED</div>
        <h2 style={{ margin: "0 0 8px" }}>“{d.decision}”</h2>
        <p className="rationale">{d.rationale}</p>
        <div className="policy-grid">
          <div className="policy-col allow">
            <span className="k">Opus 4.8 allowed for</span>
            <ul>
              {d.agent_policy.opus_4_8_allowed_for.map((x) => (
                <li key={x}>{x.replace(/_/g, " ")}</li>
              ))}
            </ul>
          </div>
          <div className="policy-col deny">
            <span className="k">refused for</span>
            <ul>
              {d.agent_policy.opus_4_8_disallowed_for.map((x) => (
                <li key={x}>{x.replace(/_/g, " ")}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="refusal-foot mono">
          approved alternative · <strong>{d.approved_alternative}</strong> · ratified by{" "}
          {d.approved_by} · effective {d.effective_period}
        </div>
      </div>

      <div className="grid cols-3" style={{ margin: "20px 0" }}>
        <div className="card stat">
          <span className="label">Ratified savings</span>
          <span className="value" style={{ color: "var(--good)" }}>
            {usd(s.ratified_savings)}/mo
          </span>
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

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Referenced context</h2>
          <p className="page-sub">
            Every artifact this decision was grounded in — the evidence anyone can re-check.
          </p>
          <ul className="context-list mono">
            {d.referenced_context.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
