import { useEffect, useState } from "react";
import { PageHeader } from "../components/Page";
import { pct, shortHash, usd } from "../lib/format";
import type { CorrectionKind } from "../lib/contract";
import {
  type CorrectionDraft,
  type ProvenanceView,
  listProvenance,
  submitCorrection,
} from "../lib/provenance";

const CORRECTION_KINDS: readonly CorrectionKind[] = [
  "inner",
  "outer",
  "cross",
  "emergence",
];

// ─── THE HERO BEAT ───
// Each finding: cites its source rows → shows its anchor receipt → Correct button.
// All data flows through src/lib/provenance.ts (the seam). Phase-3 swaps the
// fixture backend for the real provenance/ lib without touching this component.
export function Findings() {
  const [views, setViews] = useState<ProvenanceView[] | null>(null);

  useEffect(() => {
    listProvenance().then(setViews);
  }, []);

  if (!views) return <p>Loading findings…</p>;

  const total = views.reduce((s, v) => s + v.savings.monthly_savings, 0);

  return (
    <>
      <PageHeader
        title="Findings"
        sub={`${views.length} underutilized vendors · ${usd(total)}/mo reclaimable. Each finding cites its evidence and carries an anchor receipt.`}
      />
      <div className="grid" style={{ gap: 16 }}>
        {views.map((v) => (
          <FindingCard key={v.finding.id} view={v} />
        ))}
      </div>
    </>
  );
}

function FindingCard({ view }: { view: ProvenanceView }) {
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
      await submitCorrection(draft); // seam → Phase-3 wires provenance/
      setDone("Correction appended as a new linked entry (see Decision log).");
      setCorrecting(false);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  };

  const f = view.savings;
  return (
    <div className="card finding-card">
      <div className="head">
        <div>
          <span className="badge warn">{pct(f.utilization_pct)} utilized</span>{" "}
          <strong>{f.vendor}</strong>
        </div>
        <span className="savings">{usd(f.monthly_savings)}/mo</span>
      </div>

      <p style={{ margin: 0 }}>{f.recommended_action}</p>

      {/* ── Source rows (cited evidence) ── */}
      <div>
        <div className="mono" style={{ marginBottom: 4 }}>
          cites {f.source_row_ids.length} source row(s)
        </div>
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Vendor</th>
              <th className="num">Purchased</th>
              <th className="num">Active 30d</th>
              <th className="num">Monthly cost</th>
            </tr>
          </thead>
          <tbody>
            {view.sourceRows.map((r) => (
              <tr key={r.row_id}>
                <td className="mono">{r.row_id}</td>
                <td>{r.vendor}</td>
                <td className="num">{r.seats_purchased}</td>
                <td className="num">{r.active_seats_30d}</td>
                <td className="num">{usd(r.monthly_cost)}</td>
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
          {view.receipt?.anchor_txn_id
            ? ` · txn ${shortHash(view.receipt.anchor_txn_id)}`
            : " (not yet on-chain)"}
        </span>
        <span>
          verify: <span className="badge good">{view.verification_state}</span>{" "}
          {view.verification_message}
        </span>
      </div>

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
