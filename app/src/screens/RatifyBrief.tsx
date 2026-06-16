import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/Page";
import { shortHash } from "../lib/format";
import {
  type BriefGateReport,
  type Disposition,
  type RatifiableJudgment,
  buildRatifiedBrief,
  computeSeal,
  loadBriefGateReport,
} from "../lib/ratify";

const DISPOSITIONS: { key: Exclude<Disposition, "pending">; label: string; color: string }[] = [
  { key: "ratify", label: "Ratify", color: "var(--good)" },
  { key: "amend", label: "Amend", color: "var(--accent, #6fb3f0)" },
  { key: "defer", label: "Defer", color: "var(--watch, #f0b75f)" },
  { key: "drop", label: "Drop", color: "var(--bad)" },
];

// The ratification surface — the operator decides, per claim, what is allowed to become
// operational. The Seal & Export button is the boundary: disabled until every claim is decided.
// "Liminal makes AI-generated claims earn the right to become operational."
export function RatifyBrief() {
  const [report, setReport] = useState<BriefGateReport | null>(null);
  const [judgments, setJudgments] = useState<RatifiableJudgment[]>([]);
  const [exported, setExported] = useState<ReturnType<typeof buildRatifiedBrief> | null>(null);

  useEffect(() => {
    loadBriefGateReport().then((r) => {
      setReport(r);
      setJudgments(r.judgments.map((j) => ({ ...j, disposition: "pending" })));
    });
  }, []);

  const sealState = useMemo(() => computeSeal(judgments), [judgments]);

  function setDisposition(claim_id: string, disposition: Disposition) {
    setJudgments((js) => js.map((j) => (j.claim_id === claim_id ? { ...j, disposition } : j)));
    setExported(null); // any change re-opens the seal
  }
  function setAmendedText(claim_id: string, amended_text: string) {
    setJudgments((js) => js.map((j) => (j.claim_id === claim_id ? { ...j, amended_text } : j)));
  }

  if (!report) return <p>Loading brief…</p>;

  return (
    <>
      <PageHeader
        title="Ratify the brief"
        sub={`${report.brief} — the adversarial reviewer dropped the weak claims. Now you decide, per claim, what becomes operational. Nothing exports until every claim is ratified, amended, deferred, or dropped.`}
      />

      {/* The self-catch — context: the gate already dropped this; it cannot be ratified. */}
      {report.dropped.map((d) => (
        <div key={d.claim_id} className="card" style={{ marginBottom: 14, borderLeft: "3px solid var(--bad)", opacity: 0.75 }}>
          <span className="label" style={{ color: "var(--bad)" }}>✗ Dropped by the reviewer — {d.claim_id}</span>
          <p style={{ margin: "6px 0" }}>{d.text}</p>
          <p style={{ fontSize: 12, color: "var(--faint)" }}>{d.drop_reason}</p>
        </div>
      ))}

      {/* The surviving Judgments — each awaits a disposition. */}
      {judgments.map((j) => (
        <div
          key={j.claim_id}
          className="card"
          style={{
            marginBottom: 14,
            borderLeft: `3px solid ${j.disposition === "pending" ? "var(--watch, #f0b75f)" : "var(--good)"}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="label">{j.claim_id}</span>
            <span className="label" style={{ color: j.disposition === "pending" ? "var(--watch, #f0b75f)" : "var(--good)" }}>
              {j.disposition === "pending" ? "● awaiting ratification" : `✓ ${j.disposition}`}
            </span>
          </div>
          <p style={{ margin: "6px 0" }}>{j.text}</p>
          <p style={{ fontSize: 11, color: "var(--faint)" }}>anchored · {shortHash(j.packet_hash)}</p>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {DISPOSITIONS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDisposition(j.claim_id, d.key)}
                style={{
                  padding: "5px 12px",
                  border: `1px solid ${j.disposition === d.key ? d.color : "var(--line, #2a2a30)"}`,
                  background: j.disposition === d.key ? d.color : "transparent",
                  color: j.disposition === d.key ? "#0b0b0d" : d.color,
                  borderRadius: 4,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          {j.disposition === "amend" && (
            <textarea
              value={j.amended_text ?? j.text}
              onChange={(e) => setAmendedText(j.claim_id, e.target.value)}
              rows={2}
              style={{ width: "100%", marginTop: 8, background: "var(--card, #16161a)", color: "var(--text, #e6e6e6)", border: "1px solid var(--line, #2a2a30)", borderRadius: 4, padding: 8, fontFamily: "inherit" }}
            />
          )}
        </div>
      ))}

      {/* THE BOUNDARY, made visible: the export banner + the gated Seal button. */}
      <div
        className="card"
        style={{ marginTop: 18, borderLeft: `3px solid ${sealState.exportable ? "var(--good)" : "var(--bad)"}` }}
      >
        {sealState.exportable ? (
          <span className="label" style={{ color: "var(--good)" }}>✓ All claims ratified — the brief can be sealed</span>
        ) : (
          <span className="label" style={{ color: "var(--bad)" }}>✗ {sealState.blockedReason}</span>
        )}
        <div style={{ marginTop: 10 }}>
          <button
            disabled={!sealState.exportable}
            onClick={() => setExported(buildRatifiedBrief(judgments, report.brief))}
            style={{
              padding: "8px 18px",
              border: "1px solid var(--good)",
              background: sealState.exportable ? "var(--good)" : "transparent",
              color: sealState.exportable ? "#0b0b0d" : "var(--faint)",
              borderRadius: 4,
              cursor: sealState.exportable ? "pointer" : "not-allowed",
              opacity: sealState.exportable ? 1 : 0.5,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          >
            Seal &amp; Export Ratified Brief
          </button>
        </div>
      </div>

      {exported && (
        <div className="card" style={{ marginTop: 14, borderLeft: "3px solid var(--good)" }}>
          <span className="label" style={{ color: "var(--good)" }}>✓ Sealed — Ratified Brief ({exported.judgments.length} Judgments)</span>
          <pre style={{ fontSize: 11, color: "var(--text, #e6e6e6)", overflow: "auto", marginTop: 8 }}>
            {JSON.stringify(exported, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
