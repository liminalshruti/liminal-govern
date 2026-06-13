import { useEffect, useState } from "react";
import { PageHeader } from "../components/Page";
import { shortHash, usd } from "../lib/format";
import type { CorrectionKind } from "../lib/contract";
import {
  type CorrectionDraft,
  type ProvenanceView,
  getReconcile,
  listProvenance,
  submitCorrection,
} from "../lib/provenance";

const CORRECTION_KINDS: readonly CorrectionKind[] = ["inner", "outer", "cross", "emergence"];
type Reconcile = Awaited<ReturnType<typeof getReconcile>>;

// ─── THE HERO BEAT (cockpit form) ───
// The real orchestration output: per-event agent-fit findings, the verifier's
// dropped E14 claim, and an OKR reallocation. Each surviving finding shows its
// real anchor receipt (SHA-256, hash-linked); the dropped one shows why it was
// refuted. Everything flows through src/lib/provenance.ts → the real S4 report.
export function Findings() {
  const [views, setViews] = useState<ProvenanceView[] | null>(null);
  const [recon, setRecon] = useState<Reconcile | null>(null);

  useEffect(() => {
    listProvenance().then(setViews);
    getReconcile().then(setRecon);
  }, []);

  if (!views) return <p>Loading findings…</p>;

  return (
    <>
      <PageHeader
        title="Findings"
        sub="Where Opus 4.8 frontier spend should route to cheaper, verified agents — and where the adversarial reviewer caught the chain's own error. Each finding cites its evidence and anchors to a hash-chain."
      />

      {recon && (
        <div className="grid cols-3" style={{ marginBottom: 22 }}>
          <div className="card stat">
            <span className="label">Naive savings</span>
            <span className="value" style={{ color: "var(--faint)" }}>{usd(recon.naive)}/mo</span>
          </div>
          <div className="card stat">
            <span className="label">Dropped by verifier</span>
            <span className="value" style={{ color: "var(--bad)" }}>−{usd(recon.dropped)}</span>
          </div>
          <div className="card stat">
            <span className="label">Verified realizable</span>
            <span className="value" style={{ color: "var(--good)" }}>{usd(recon.total)}/mo</span>
          </div>
        </div>
      )}

      <div className="grid" style={{ gap: 16 }}>
        {views.map((v) => (
          <FindingCard key={v.finding_id} view={v} />
        ))}
      </div>
    </>
  );
}

function FindingCard({ view }: { view: ProvenanceView }) {
  const [correcting, setCorrecting] = useState(false);
  const [kind, setKind] = useState<CorrectionKind>("cross");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ packet_hash: string } | null>(null);

  const onSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    const draft: CorrectionDraft = {
      source_packet_id: view.finding_id,
      correction_kind: kind,
      reason: reason.trim(),
    };
    try {
      const res = await submitCorrection(draft);
      setDone({ packet_hash: res.packet_hash });
      setCorrecting(false);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  };

  const isOkr = view.type === "okr_misalignment";
  const typeBadge = view.dropped ? (
    <span className="badge bad dot">refuted &amp; dropped</span>
  ) : isOkr ? (
    <span className="badge accent dot">reallocation</span>
  ) : (
    <span className="badge good dot">agent-fit</span>
  );

  return (
    <div className={`card finding-card${view.dropped ? " amended" : ""}`}>
      <div className="head">
        <div>
          {typeBadge}{" "}
          {view.category && <span className="badge">{view.category}</span>}{" "}
          {view.employee && <span className="mono">· {view.employee}</span>}
          <div className="title" style={{ marginTop: 8, textDecoration: view.dropped ? "line-through" : "none", color: view.dropped ? "var(--faint)" : "inherit" }}>
            {view.title}
          </div>
        </div>
        {!isOkr && (
          <div className="savings">
            {view.dropped ? (
              <span className="was" style={{ fontSize: 17 }}>{usd(view.monthly_savings)}/mo</span>
            ) : (
              <span className="num">{usd(view.monthly_savings)}/mo</span>
            )}
          </div>
        )}
      </div>

      {/* Agent-fit recommendation */}
      {view.approved_alternative && !view.dropped && (
        <div className="agent-fit">
          <span>→ route to</span>
          <span className="chip">{view.approved_alternative}</span>
          <span style={{ color: "var(--muted)" }}>· registry-verified · ~10% of Opus cost</span>
        </div>
      )}

      {/* The dropped-claim explanation — the adversarial-verifier beat */}
      {view.dropped && view.drop_reason && (
        <div className="correction-strip">
          <span className="mark">🪤</span>
          <div className="body">
            <strong>Verifier dropped this claim.</strong> {view.drop_reason}
          </div>
        </div>
      )}

      {/* Cited source events (the evidence) */}
      {view.sourceEvents.length > 0 && (
        <details className="evidence">
          <summary>cites {view.sourceEvents.length} usage event(s) →</summary>
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Who</th>
                <th>Task</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {view.sourceEvents.map((e) => (
                <tr key={e.event_id}>
                  <td className="mono">{e.event_id}</td>
                  <td className="mono">{e.date}</td>
                  <td>{e.employee}</td>
                  <td>{e.task_label}</td>
                  <td className="num">{usd(e.est_cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/* Anchor receipt (real, from the S4 provenance chain) */}
      {view.receipt ? (
        <div className="receipt mono">
          <span><span className="k">packet_hash</span> {shortHash(view.receipt.packet_hash)}</span>
          <span><span className="k">prev_hash</span> {shortHash(view.receipt.prev_hash)}</span>
          <span className="full">
            <span className="k">anchor</span> {view.receipt.anchor_chain} · {view.receipt.anchor_network} (not yet on-chain)
          </span>
          <span className="full">
            <span className="k">verify</span>{" "}
            <span className="badge good">{view.verification_state}</span> {view.verification_message}
          </span>
        </div>
      ) : (
        <div className="receipt mono">
          <span className="full">
            <span className="k">verify</span>{" "}
            <span className={`badge ${view.dropped ? "bad" : "accent"}`}>{view.verification_state}</span>{" "}
            {view.verification_message}
          </span>
        </div>
      )}

      {/* Correct button — appends a real-hashed linked entry, never mutates */}
      {!correcting ? (
        <div className="row-actions">
          <button type="button" onClick={() => { setDone(null); setCorrecting(true); }}>
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
                  name={`kind-${view.finding_id}`}
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
            <button type="button" className="accent" disabled={submitting || !reason.trim()} onClick={onSubmit}>
              {submitting ? "Hashing…" : "Sign correction →"}
            </button>
            <button type="button" onClick={() => setCorrecting(false)}>Cancel</button>
          </div>
        </div>
      )}

      {done && (
        <p className="done-note">
          ✓ Correction appended &amp; anchored — <span className="mono">{shortHash(done.packet_hash)}</span>. See the decision log.
        </p>
      )}
    </div>
  );
}
