import { PageHeader } from "../components/Page";
import { REPORT } from "../lib/report";
import { usd } from "../lib/format";

// Beat 4 (support) — the registry-verified, lower-cost agents that off-objective
// Opus 4.8 work gets routed to. Derived from out/report.json findings.
interface ApprovedAgent {
  id: string;
  name: string;
  handles: string;
  routed_savings: number;
  events: number;
}

function approvedAgents(): ApprovedAgent[] {
  const byId = new Map<string, ApprovedAgent>();
  for (const f of REPORT.findings) {
    if (f.dropped || !f.approved_alternative_id || !f.approved_alternative) continue;
    const existing = byId.get(f.approved_alternative_id);
    if (existing) {
      existing.routed_savings += f.monthly_savings;
      existing.events += f.source_row_ids.length;
    } else {
      byId.set(f.approved_alternative_id, {
        id: f.approved_alternative_id,
        name: f.approved_alternative,
        handles: f.category ?? "—",
        routed_savings: f.monthly_savings,
        events: f.source_row_ids.length,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.routed_savings - a.routed_savings);
}

export function AgentRegistry() {
  const agents = approvedAgents();
  const d = REPORT.ratified_decision;

  return (
    <>
      <PageHeader
        title="Approved agents"
        sub="Off-objective Opus 4.8 work is routed to registry-verified, lower-cost agents (~10% of Opus cost). The governed model stays on the approved track."
      />

      <div className="grid" style={{ gap: 16, marginBottom: 24 }}>
        {/* The governed model */}
        <div className="card agent-card">
          <div className="head">
            <div>
              <strong>{REPORT.okr_baseline.approved_model}</strong>{" "}
              <span className="badge">governed model</span>
            </div>
            <span className="mono">{usd(REPORT.misalignment.opus_total_usd)}/mo</span>
          </div>
          <p style={{ margin: 0 }}>
            Allowed for {d.agent_policy.opus_4_8_allowed_for.join(", ").replace(/_/g, " ")}.
            Refused for {d.agent_policy.opus_4_8_disallowed_for.join(", ").replace(/_/g, " ")}.
          </p>
        </div>

        {agents.map((a) => (
          <div className="card agent-card" key={a.id}>
            <div className="head">
              <div>
                <strong>{a.name}</strong>{" "}
                <span className="badge good">registry-verified</span>
              </div>
              <span className="savings">{usd(a.routed_savings)}/mo reclaimed</span>
            </div>
            <p style={{ margin: 0 }}>
              Handles <strong>{a.handles.replace(/_/g, " ")}</strong> — {a.events} event(s)
              routed off Opus 4.8 at ~10% of the cost.
            </p>
            <div className="mono" style={{ color: "var(--muted)" }}>
              agent_id: {a.id} · approved alternative · {a.handles}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
