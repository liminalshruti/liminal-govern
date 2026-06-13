import { PageHeader } from "../components/Page";
import { shortHash } from "../lib/format";
import {
  type AgentCard,
  type FitRecommendation,
  getAgent,
  listAgents,
  listFitRecommendations,
  verifyAttestations,
} from "../lib/agentFit";

/**
 * Agent-fit / trustless-agents surface (lane E).
 *
 * PRIOR ART: concept reused & restyled from the public `algorand-berlin-2026`
 * trustless-agents asset (agent registry + marketplace + on-chain attestation
 * badges). Adapted here — NOT copied verbatim — into the governance product:
 * the *bounded* swarm (Analyst / SDR / Auditor / Operator), a fit recommendation
 * matching each agent to a governance task, and a trustless attestation badge per
 * agent that mirrors the contract `AnchorReceipt` proof. All data is in-app via
 * src/lib/agentFit.ts (shapes mirror src/lib/contract.ts).
 */
export function AgentFit() {
  const agents = listAgents();
  const fits = listFitRecommendations();
  const att = verifyAttestations();

  return (
    <>
      <PageHeader
        title="Agent fit"
        sub="The bounded governance swarm as a trustless registry: each agent occupies one lane, fits specific governance tasks, and carries an anchored attestation you can verify."
      />

      <div className="grid cols-3" style={{ marginBottom: 24 }}>
        <div className="card stat">
          <span className="label">Registered agents</span>
          <span className="value">{att.total}</span>
        </div>
        <div className="card stat">
          <span className="label">On-chain attested</span>
          <span className="value">
            {att.anchored}
            <small style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>
              {" "}/ {att.total}
            </small>
          </span>
        </div>
        <div className="card stat">
          <span className="label">Attestation chain</span>
          <span className="value" style={{ color: att.ok ? "var(--good)" : "var(--bad)" }}>
            {att.ok ? "Verified" : "Broken"}
          </span>
        </div>
      </div>

      <h2>Agent registry</h2>
      <p className="page-sub">
        Each agent acts only inside its lane and refuses out-of-lane work. Hover the
        read to see how the agent frames a context (contract <code>AgentRead</code>).
      </p>
      <div className="grid" style={{ gap: 16, marginBottom: 28 }}>
        {agents.map((a) => (
          <AgentRegistryCard key={a.agent_id} agent={a} />
        ))}
      </div>

      <h2>Fit recommendation</h2>
      <p className="page-sub">
        Which bounded agent fits which governance task — matched by lane, ranked by
        scope overlap. The swarm self-selects; the operator still ratifies.
      </p>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Governance task</th>
              <th>Lane</th>
              <th>Recommended agent</th>
              <th className="num">Fit</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {fits.map((f) => (
              <FitRow key={f.task_id} fit={f} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AgentRegistryCard({ agent }: { agent: AgentCard }) {
  const r = agent.read;
  return (
    <div className="card finding-card">
      <div className="head">
        <div>
          <strong>{agent.agent_name}</strong>{" "}
          <span className="badge">{agent.lane}</span>
        </div>
        <AttestationBadge agent={agent} />
      </div>

      <p style={{ margin: 0 }}>{agent.scope}</p>

      {/* Representative read — mirrors contract AgentRead */}
      <details>
        <summary className="mono" style={{ cursor: "pointer" }}>
          read · "{r.quoted}"
        </summary>
        <div className="mono" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
          <span>situation: {r.situation}</span>
          <span>hidden_risk: {r.hidden_risk}</span>
          <span>next_move: {r.next_move}</span>
        </div>
      </details>

      <div className="mono" style={{ color: "var(--warn)" }}>
        refuses: {agent.refuses}
      </div>
    </div>
  );
}

/** Trustless attestation badge — mirrors the contract AnchorReceipt proof. */
function AttestationBadge({ agent }: { agent: AgentCard }) {
  const a = agent.attestation;
  const onChain = a.anchor_chain === "algorand";
  return (
    <span
      className={`badge ${onChain ? "good" : ""}`}
      title={[
        `packet_hash: ${a.packet_hash}`,
        `prev_hash: ${a.prev_hash ?? "—"}`,
        `anchor: ${a.anchor_chain} · ${a.anchor_network}`,
        a.anchor_txn_id ? `txn: ${a.anchor_txn_id}` : "(local-first, not yet on-chain)",
        `attested_at: ${a.anchored_at}`,
      ].join("\n")}
      style={{ whiteSpace: "nowrap" }}
    >
      {onChain ? "⛓ attested" : "⛉ local"} · {shortHash(a.packet_hash)}
    </span>
  );
}

function FitRow({ fit }: { fit: FitRecommendation }) {
  const agent = getAgent(fit.fit_agent_id);
  const band = fit.fit_score >= 85 ? "good" : "warn";
  return (
    <tr>
      <td>{fit.task}</td>
      <td>
        <span className="badge">{fit.lane}</span>
      </td>
      <td>
        <strong>{agent?.agent_name ?? fit.fit_agent_id}</strong>
        {agent && (
          <>
            {" "}
            <AttestationBadge agent={agent} />
          </>
        )}
      </td>
      <td className="num">
        <span className={`badge ${band}`}>{fit.fit_score}</span>
      </td>
      <td className="mono">{fit.rationale}</td>
    </tr>
  );
}
