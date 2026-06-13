import { useEffect, useState } from "react";
import { PageHeader } from "../components/Page";
import type { Correction } from "../lib/contract";
import {
  listCorrections,
  listDropped,
  listProvenance,
  type ProvenanceView,
} from "../lib/provenance";
import { REPORT } from "../lib/report";

// Decision log: the append-only trail of findings, the refuted claim, the ratified
// decision, and live corrections. Source of truth: out/report.json.
export function DecisionLog() {
  const [views, setViews] = useState<ProvenanceView[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const dropped = listDropped();

  useEffect(() => {
    listProvenance().then(setViews);
    setCorrections(listCorrections());
  }, []);

  return (
    <>
      <PageHeader
        title="Decision log"
        sub="Append-only trail: every finding entered the chain, the refuted claim was dropped, and every correction is a new linked entry — never a mutation."
      />

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Entry</th>
              <th>Kind</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {views.map((v) => (
              <tr key={v.finding.id}>
                <td className="mono">{v.finding.id}</td>
                <td>
                  <span className="badge good">anchored</span>
                </td>
                <td>{v.reportFinding.recommended_action}</td>
              </tr>
            ))}
            {dropped.map(({ finding }) => (
              <tr key={finding.finding_id}>
                <td className="mono">{finding.finding_id}</td>
                <td>
                  <span className="badge bad">refuted · dropped</span>
                </td>
                <td>{finding.drop_reason}</td>
              </tr>
            ))}
            <tr>
              <td className="mono">D-RATIFY-CAL</td>
              <td>
                <span className="badge">ratified</span>
              </td>
              <td>{REPORT.ratified_decision.decision}</td>
            </tr>
            {corrections.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.id.slice(0, 14)}…</td>
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
