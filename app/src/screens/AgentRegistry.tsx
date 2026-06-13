import { PageHeader, StubBanner } from "../components/Page";

// Stubbed. Renders a small static registry so the shape is legible; the real
// agent-fit / trustless-agents UI (reuse of the algorand-berlin-2026 asset)
// plugs in here later. Shape mirrors contract.ts AgentRead.archetype lanes.
const AGENTS = [
  { agent_name: "Auditor", archetype: "diligence", scope: "reconciles spend ⋈ activity, emits findings" },
  { agent_name: "Analyst", archetype: "diligence", scope: "baselines OKRs against spend" },
  { agent_name: "SDR", archetype: "outreach", scope: "drafts vendor right-size negotiations" },
  { agent_name: "Operator", archetype: "operations", scope: "applies ratified caps, schedules reviews" },
];

export function AgentRegistry() {
  return (
    <>
      <PageHeader
        title="Agent registry"
        sub="Bounded agents and the lanes they occupy. Each finding records which agent read it."
      />
      <StubBanner>
        Static placeholder. Phase-3 wires the live registry + agent-fit recommendation
        (reuse of the public algorand-berlin-2026 asset).
      </StubBanner>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Archetype / lane</th>
              <th>Scope</th>
            </tr>
          </thead>
          <tbody>
            {AGENTS.map((a) => (
              <tr key={a.agent_name}>
                <td>
                  <strong>{a.agent_name}</strong>
                </td>
                <td>
                  <span className="badge">{a.archetype}</span>
                </td>
                <td>{a.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
