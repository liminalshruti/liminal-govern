import { useEffect, useState } from "react";
import { PageHeader, StubBanner } from "../components/Page";
import type { Correction } from "../lib/contract";
import { listCorrections, listProvenance, type ProvenanceView } from "../lib/provenance";

// Decision log: the append-only trail of findings + corrections. Findings are
// produced by the Node engine (analyze + anchorFindings) and baked in at build
// time; corrections are appended live as new linked chain entries (localStorage).
export function DecisionLog() {
  const [views, setViews] = useState<ProvenanceView[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);

  useEffect(() => {
    listProvenance().then(setViews);
    setCorrections(listCorrections());
  }, []);

  return (
    <>
      <PageHeader
        title="Decision log"
        sub="Append-only trail: every finding entered the chain; every correction is a new linked entry, never a mutation."
      />
      <StubBanner>
        Findings are real engine output, anchored to the provenance chain at build time.
        Corrections append as new linked entries (persisted locally) and re-anchor the chain.
      </StubBanner>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Kind</th>
              <th>Entry</th>
            </tr>
          </thead>
          <tbody>
            {views.map((v) => (
              <tr key={v.finding.id}>
                <td className="mono">{v.finding.created_at.slice(0, 10)}</td>
                <td>
                  <span className="badge">finding</span>
                </td>
                <td>{v.savings.recommended_action}</td>
              </tr>
            ))}
            {corrections.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.created_at.slice(0, 10)}</td>
                <td>
                  <span className="badge warn">correction · {c.correction_kind}</span>
                </td>
                <td>
                  {c.reason} <span className="mono">→ {c.source_packet_id}</span>
                </td>
              </tr>
            ))}
            {corrections.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: "var(--muted)" }}>
                  No corrections this session. Sign one on the Findings screen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
