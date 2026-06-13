import { useEffect, useState } from "react";
import { PageHeader, StubBanner } from "../components/Page";
import type { Correction } from "../lib/contract";
import { listCorrections, listProvenance, type ProvenanceView } from "../lib/provenance";

// Decision log: the append-only trail of findings + corrections. Findings come
// from the seam; corrections come from the in-session correction log (Phase-3:
// provenance/ persists both as linked chain entries).
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
        Findings are real; corrections reflect this session only. Phase-3 persists both via
        provenance/ so the log survives reloads and links cryptographically.
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
                <td>{v.finding.context}</td>
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
