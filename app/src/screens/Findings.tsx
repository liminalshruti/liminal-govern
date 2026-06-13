import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/Page";
import { shortHash, usd } from "../lib/format";
import type { CorrectionKind } from "../lib/contract";
import {
  type CorrectionDraft,
  type ProvenanceView,
  engineReport,
  listProvenance,
  submitCorrection,
  verifyChain,
} from "../lib/provenance";

const CORRECTION_KINDS: readonly CorrectionKind[] = ["inner", "outer", "cross", "emergence"];

type ChainState = Awaited<ReturnType<typeof verifyChain>>;

const AGENT_LABEL: Record<string, string> = {
  calendarops: "CalendarOps Agent",
  digestbot: "DigestBot",
};

// ─── THE HERO BEAT ───
// AI-spend governance findings from the S4 deliberation: agent-fit routings to
// verified cheaper agents, an OKR misalignment, and the DROPPED E14 claim the
// adversarial reviewer refuted (PR-103). Each surviving finding cites its usage
// events and shows its real anchor receipt; clicking Correct appends a new linked
// entry to the browser-native chain and live-re-verifies. All via provenance.ts.
export function Findings() {
  const [views, setViews] = useState<ProvenanceView[] | null>(null);
  const [chain, setChain] = useState<ChainState | null>(null);

  const refresh = useCallback(async () => {
    const [v, c] = await Promise.all([listProvenance(), verifyChain()]);
    setViews(v);
    setChain(c);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!views) return <p>Loading findings…</p>;

  return (
    <>
      <PageHeader
        title="Findings"
        sub={`Where Opus 4.8 frontier spend should route to cheaper, verified agents — and where the adversarial reviewer caught the chain's own error. Each finding cites its usage events and anchors to a hash-chain.`}
      />

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <div className="card stat">
          <span className="label">Naive savings</span>
          <span className="value" style={{ color: "var(--muted)" }}>{usd(engineReport.naive_savings)}/mo</span>
        </div>
        <div className="card stat">
          <span className="label">Dropped by reviewer</span>
          <span className="value" style={{ color: "var(--bad)" }}>−{usd(engineReport.dropped_total)}</span>
        </div>
        <div className="card stat">
          <span className="label">Verified realizable</span>
          <span className="value" style={{ color: "var(--good)" }}>{usd(engineReport.monthly_savings_total)}/mo</span>
        </div>
      </div>

      {/* ── Chain-integrity verify badge (browser-native provenance chain) ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="receipt mono">
          <span>
            chain integrity:{" "}
            <span className={`badge ${chain?.ok ? "good" : "warn"}`}>
              {chain ? (chain.ok ? "verified" : "broken") : "…"}
            </span>{" "}
            {chain
              ? `${chain.links.length} linked entr${chain.links.length === 1 ? "y" : "ies"} · SHA-256 hash-linked (mirrors provenance/ scheme)`
              : "verifying…"}
          </span>
        </div>
      </div>

      <div className="grid" style={{ gap: 16 }}>
        {views.map((v) => (
          <FindingCard key={v.finding.id} view={v} onCorrected={refresh} />
        ))}
      </div>
    </>
  );
}

function FindingCard({
  view,
  onCorrected,
}: {
  view: ProvenanceView;
  onCorrected: () => Promise<void>;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [kind, setKind] = useState<CorrectionKind>("cross");
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

  const f = view.savings;
  const isOkr = view.type === "okr_misalignment";
  const agentLabel = view.approved_alternative_id
    ? AGENT_LABEL[view.approved_alternative_id] ?? view.approved_alternative
    : view.approved_alternative;

  const typeBadge = view.dropped ? (
    <span className="badge bad">refuted &amp; dropped</span>
  ) : isOkr ? (
    <span className="badge accent">reallocation</span>
  ) : (
    <span className="badge good">agent-fit</span>
  );

  return (
    <div className="card finding-card">
      <div className="head">
        <div>
          {typeBadge}{" "}
          {view.category && <span className="badge">{view.category}</span>}{" "}
          {view.employee && <span className="mono">· {view.employee}</span>}
          <div
            style={{
              marginTop: 8,
              fontWeight: 600,
              textDecoration: view.dropped ? "line-through" : "none",
              color: view.dropped ? "var(--muted)" : "inherit",
            }}
          >
            {f.recommended_action}
          </div>
        </div>
        {!isOkr && (
          <span className="savings" style={{ color: view.dropped ? "var(--muted)" : "var(--good)" }}>
            {view.dropped ? <s>{usd(f.monthly_savings)}/mo</s> : `${usd(f.monthly_savings)}/mo`}
          </span>
        )}
      </div>

      {/* Agent-fit recommendation */}
      {agentLabel && !view.dropped && (
        <div className="receipt mono" style={{ borderTop: "none", paddingTop: 0 }}>
          <span>→ route to <strong style={{ color: "var(--accent)" }}>{agentLabel}</strong> · registry-verified · ~10% of Opus cost</span>
        </div>
      )}

      {/* The dropped-claim explanation — the adversarial-reviewer beat */}
      {view.dropped && view.drop_reason && (
        <div className="correction-trail" style={{ background: "var(--bad-soft, #fdeaee)", borderRadius: 8, padding: "10px 12px" }}>
          <strong style={{ color: "var(--bad)" }}>🪤 Reviewer dropped this claim.</strong> {view.drop_reason}
        </div>
      )}

      {/* ── Source usage events (cited evidence) ── */}
      {view.sourceEvents.length > 0 && (
        <div>
          <div className="mono" style={{ marginBottom: 4 }}>
            cites {view.sourceEvents.length} usage event(s)
          </div>
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
        </div>
      )}

      {/* ── Anchor receipt (real SHA-256, or refuted) ── */}
      {view.receipt ? (
        <div className="receipt mono">
          <span>packet_hash: {shortHash(view.receipt.packet_hash)}</span>
          <span>prev_hash: {shortHash(view.receipt.prev_hash)}</span>
          <span>
            anchor: {view.receipt.anchor_chain} · {view.receipt.anchor_network} (not yet on-chain)
          </span>
          <span>
            verify: <span className="badge good">{view.verification_state}</span>{" "}
            {view.verification_message}
          </span>
        </div>
      ) : (
        <div className="receipt mono">
          <span>
            verify: <span className="badge bad">{view.verification_state}</span>{" "}
            {view.verification_message}
          </span>
        </div>
      )}

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
            <button type="button" className="primary" disabled={submitting || !reason.trim()} onClick={onSubmit}>
              {submitting ? "Signing…" : "Sign correction →"}
            </button>
            <button type="button" onClick={() => setCorrecting(false)}>Cancel</button>
          </div>
        </div>
      )}

      {done && <p className="done-note">{done}</p>}
    </div>
  );
}
