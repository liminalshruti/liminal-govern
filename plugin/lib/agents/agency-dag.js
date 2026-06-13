// agency-dag.js — workflow-DAG typing for the three front-door agents.
//
// PUBLIC-SAFE REIMPLEMENTATION. The private liminal-agents substrate defines a
// 12-agent agency DAG (plus a separate 12-agent introspective polarity-clock).
// The front door only ships three agents — Analyst, SDR, Auditor — so we keep
// just the slice of the workflow graph that connects them. Same idea: an
// agent's refusal "bound" is its workflow neighborhood (predecessors it is fed
// by, successors it feeds). Refusing means "this is the predecessor's step or
// the successor's step, not mine."
//
// discover (Analyst) → decide (Auditor) → do/outbound (SDR)
//
//   Analyst  feeds  Auditor              (analysis → readiness judgment)
//   Auditor  feeds  SDR                  (judgment → the outbound move)
//   SDR      is fed by Auditor; redirects research back to Analyst.
//
// The SDR's bound is intentionally {Analyst, Auditor} so the SDR can refuse a
// research request to the Analyst directly (the common front-door miss).

export const AGENCY_DAG = Object.freeze({
  Analyst: {
    phase: "discover",
    direction: "inbound",
    predecessors: [],
    successors: ["Auditor"],
  },
  Auditor: {
    phase: "decide",
    direction: "inbound",
    predecessors: ["Analyst"],
    successors: ["SDR"],
  },
  SDR: {
    phase: "do",
    direction: "outbound",
    predecessors: ["Auditor"],
    successors: [],
    // The SDR's most common out-of-lane request is research; allow a direct
    // redirect to the Analyst even though it is not a DAG-adjacent edge.
    redirects: ["Analyst"],
  },
});

export function hasAgencyTyping(agent) {
  return Boolean(agent && AGENCY_DAG[agent.name]);
}

// The refusal bound: predecessors ∪ successors ∪ explicit redirects.
export function dagNeighbors(agent, allAgents) {
  const entry = AGENCY_DAG[agent?.name];
  if (!entry) return [];
  const names = new Set([
    ...entry.predecessors,
    ...entry.successors,
    ...(entry.redirects || []),
  ]);
  return allAgents.filter((a) => names.has(a.name));
}
