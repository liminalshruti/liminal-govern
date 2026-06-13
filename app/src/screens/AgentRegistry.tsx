import { useEffect, useState } from "react";
import { PageHeader } from "../components/Page";

// The agent registry — the verified agents findings can route to. Real data from
// data/agent-registry.json (the trustless-registry beat): CalendarOps and
// DigestBot are registry-verified and far cheaper than the frontier model, which
// is exactly why the agent-fit findings recommend them.
interface Agent {
  id: string;
  name: string;
  type: string;
  model?: string;
  cost_tier: string;
  cost_vs_opus?: string;
  approved_for: string[];
  verified: boolean;
  provenance?: string;
  publisher?: string;
}

export function AgentRegistry() {
  const [agents, setAgents] = useState<Agent[] | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/agent-registry.json`)
      .then((r) => r.json())
      .then((d) => setAgents(d.agents));
  }, []);

  return (
    <>
      <PageHeader
        title="Agent registry"
        sub="The verified agents the cockpit can route work to. Verification is provenance: a registry-verified agent trades frontier spend for a known, attestable identity — not a cheaper unknown."
      />

      {!agents ? (
        <p>Loading registry…</p>
      ) : (
        <div className="grid cols-2">
          {agents.map((a) => (
            <div className="card" key={a.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 650, fontSize: 15 }}>{a.name}</div>
                  <div className="mono">{a.type}{a.model ? ` · ${a.model}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {a.verified && <span className="badge good dot">verified</span>}
                  <span className={`badge ${a.cost_tier === "high" ? "warn" : "accent"} dot`}>
                    {a.cost_tier} cost{a.cost_vs_opus ? ` · ${a.cost_vs_opus}` : ""}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {a.approved_for.map((lane) => (
                  <span key={lane} className="badge">{lane}</span>
                ))}
              </div>

              {a.provenance && (
                <div className="mono" style={{ borderTop: "1px solid var(--line-2)", paddingTop: 8 }}>
                  provenance: {a.provenance}
                  {a.publisher ? ` · ${a.publisher}` : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
