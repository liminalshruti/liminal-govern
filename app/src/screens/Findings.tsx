import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/Page";
import { shortHash, usd } from "../lib/format";
import type { CorrectionKind } from "../lib/contract";
import {
  type CorrectionDraft,
  type ProvenanceView,
  listDropped,
  listProvenance,
  submitCorrection,
  verifyChain,
} from "../lib/provenance";

const CORRECTION_KINDS: readonly CorrectionKind[] = ["inner", "outer", "cross", "emergence"];

type ChainState = Awaited<ReturnType<typeof verifyChain>>;

// ─── THE HERO BEAT ───
// Each finding cites its source events → shows its anchor receipt → Correct button.
// The refuted claim (E14) sits on top, showing the disagreement the operator settled.
export function Findings() {
  const [views, setViews] = useState<ProvenanceView[] | null>(null);
  const [chain, setChain] = useState<ChainState | null>(null);
  const dropped = listDropped();

  const refresh = useCallback(async () => {
    const [v, c] = await Promise.all([listProvenance(), verifyChain()]);
    setViews(v);
    setChain(c);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!views) return <p>Loading findings…</p>;

  const total = views.reduce((s, v) => s + v.reportFinding.monthly_savings, 0);

  return (
    <>
      <PageHeader
        title="Findings & corrections"
        sub={`${views.length} evidence-backed findings · ${usd(total)}/mo reclaimable. Each finding cites its usage events and carries a provenance anchor.`}
      />

      {/* ── The refuted claim — the disagreement the operator settled ── */}
      {dropped.map(({ finding, evidence }) => (
        <div className="card dropped-card" key={finding.finding_id}>
          <div className="dropped-flag">REFUTED · CLAIM DROPPED</div>
          <div className="head">
            <div>
              <span className="badge bad">{finding.finding_id}</span>{" "}
              <strong>{finding.employee}</strong> · {finding.category}
            </div>
            <span className="savings struck">{usd(finding.monthly_savings)}/mo</span>
          </div>
          <p style={{ margin: 0 }}>{finding.recommended_action}</p>
          <div className="drop-reason">
            <span className="k">why it was dropped</span>
            <p>{finding.drop_reason}</p>
          </div>
          <div className="mono evidence-line">
            cited {evidence.map((e) => e.source_row).join(", ")} · refuted against
            pr-evidence.csv#PR-103 — not anchored
          </div>
        </div>
      ))}

      {/* ── Chain-integrity verify badge ── */}
      <div className="card chain-badge" style={{ marginBottom: 16 }}>
        <span>
          chain integrity{" "}
          <span className={`badge ${chain?.ok ? "good" : "warn"}`}>
            {chain ? (chain.ok ? "verified" : "broken") : "…"}
          </span>
        </span>
        <span className="mono">
          {chain
            ? `${chain.links.length} linked entries · SHA-256 hash-linked, re-verified in-browser`
            : "verifying…"}
        </span>
      </div>

      <div className="grid" style={{ gap: 16 }}>
        {views.map((v) => (
          <FindingCard key={v.finding.id} view={v} onCorrected={refresh} />
        ))}
      </div>
    </>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  calendar_admin: "calendar / admin",
  summarization: "summarization",
  security_hardening: "security hardening",
};

function FindingCard({
  view,
  onCorrected,
}: {
  view: ProvenanceView;
  onCorrected: () => Promise<void>;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [kind, setKind] = useState<CorrectionKind>("outer");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    const draft: CorrectionDraft = {
      source_packet_id: view.finding.id,
      correction_kind: kind,
      reason: reason.trim(),
    };
    try {
      const { correction } = await submitCorrection(draft);
      await onCorrected();
      setDone(`Correction ${shortHash(correction.id)} appended as a new linked entry & re-anchored.`);
      setCorrecting(false);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  };

  const f = view.reportFinding;
  const isOkr = f.type === "okr_misalignment";

  return (
    <div className="card finding-card">
      <div className="head">
        <div>
          <span className={`badge ${isOkr ? "warn" : "good"}`}>
            {isOkr ? "OKR misalignment" : "agent-fit routing"}
          </span>{" "}
          <strong>{f.employee ?? "Team-wide"}</strong>
          {f.category && (
            <span className="muted-tag"> · {CATEGORY_LABEL[f.category] ?? f.category}</span>
          )}
        </div>
        <span className="savings">{usd(f.monthly_savings)}/mo</span>
      </div>

      <p style={{ margin: 0 }}>{f.recommended_action}</p>

      {f.approved_alternative && (
        <div className="route-to mono">
          route → <strong>{f.approved_alternative}</strong> (registry-verified, ~10% of
          Opus cost)
        </div>
      )}

      {/* ── Cited evidence (classified usage events) ── */}
      <div>
        <div className="mono" style={{ marginBottom: 4 }}>
          cites {view.evidence.length} usage event(s)
        </div>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Model</th>
              <th>Category</th>
              <th className="num">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {view.evidence.map((e) => (
              <tr key={e.event_id}>
                <td className="mono">{e.source_row}</td>
                <td className="mono">{e.model}</td>
                <td>{e.category}</td>
                <td className="num">{usd(e.est_cost_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Anchor receipt (contract.ts AnchorReceipt) ── */}
      <div className="receipt mono">
        <span>packet_hash: {shortHash(view.receipt?.packet_hash)}</span>
        <span>prev_hash: {shortHash(view.receipt?.prev_hash)}</span>
        <span>
          anchor: {view.receipt?.anchor_chain} · {view.receipt?.anchor_network}
        </span>
        <span>
          verify: <span className="badge good">{view.verification_state}</span>{" "}
          {view.verification_message}
        </span>
      </div>

      {/* ── Correction trail (new linked entries; never mutations) ── */}
      {view.corrections.length > 0 && (
        <div className="correction-trail">
          <div className="mono" style={{ marginBottom: 4 }}>
            correction trail · {view.corrections.length} linked entr
            {view.corrections.length === 1 ? "y" : "ies"}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {view.corrections.map((c) => (
              <li key={c.id}>
                <span className="badge warn">{c.correction_kind}</span> {c.reason}{" "}
                <span className="mono" style={{ color: "var(--muted)" }}>
                  · {c.created_at.slice(0, 19).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Correct button (appends a linked entry; never mutates) ── */}
      {!correcting ? (
        <div className="row-actions">
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setCorrecting(true);
            }}
          >
            Correct this finding →
          </button>
        </div>
      ) : (
        <div className="correct-box">
          <div className="kinds">
            {CORRECTION_KINDS.map((k) => (
              <label key={k}>
                <input
                  type="radio"
                  name={`kind-${view.finding.id}`}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                />{" "}
                {k}
              </label>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What did this finding get wrong?"
            rows={3}
          />
          <div className="row-actions">
            <button
              type="button"
              className="primary"
              disabled={submitting || !reason.trim()}
              onClick={onSubmit}
            >
              {submitting ? "Signing…" : "Sign correction →"}
            </button>
            <button type="button" onClick={() => setCorrecting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {done && <p className="done-note">{done}</p>}
    </div>
  );
}
