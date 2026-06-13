// Runtime validation of the bounded-refusal protocol.
//
// PUBLIC-SAFE REIMPLEMENTATION of the private liminal-agents validator (the
// private version also classifies clock-geometry violations; the front door
// keeps the DAG-bound check). Agents respond either with normal in-lane prose,
// OR with a refusal in the exact format:
//
//   REFUSE: <AgentName>
//   <one-sentence boundary>
//
// where <AgentName> is the canonical Name of one of the bound agents.
//
// We validate the shape at runtime — not to reject (don't break the loop on
// prompt drift) but to log + surface issues. Strict-failure happens at the
// test layer, not in the runtime path.
//
// CLASSIFICATIONS
//   { kind: "prose" }                        — non-refusal output
//   { kind: "valid_refusal", target }        — well-formed refusal naming a known agent
//   { kind: "malformed_refusal", reason }    — REFUSE: prefix with no parseable name
//   { kind: "unknown_target", target }       — REFUSE: <name> where <name> is not in allAgents
//   { kind: "geometry_violation", target }   — REFUSE: <name> in allAgents but outside the
//                                              active agent's workflow neighborhood (only when
//                                              opts.activeAgent is supplied)
//   { kind: "empty" }                        — empty / whitespace-only output

import { hasAgencyTyping, dagNeighbors } from "./agency-dag.js";

const REFUSAL_PREFIX = "REFUSE:";

export function isRefusal(interpretation) {
  if (typeof interpretation !== "string") return false;
  return interpretation.trimStart().startsWith(REFUSAL_PREFIX);
}

export function classifyInterpretation(interpretation, allAgents, opts = {}) {
  if (!interpretation || !interpretation.trim()) {
    return { kind: "empty" };
  }

  const text = interpretation.trim();

  if (!isRefusal(text)) {
    return { kind: "prose" };
  }

  // Match either:
  //   "REFUSE: AgentName\n<reason>"  (two-line)
  //   "REFUSE: AgentName <reason>"   (single-line, with separator)
  const match = text.match(/^REFUSE:\s+([A-Za-z][\w\s]*?)(?:\n|\s+·\s+|$)/);
  if (!match) {
    return {
      kind: "malformed_refusal",
      reason: "expected `REFUSE: <AgentName>` followed by newline or boundary text",
    };
  }

  const targetRaw = match[1].trim();
  const knownByName = new Map(allAgents.map((a) => [a.name, a]));

  let resolvedAgent = knownByName.get(targetRaw);
  let normalized = false;
  if (!resolvedAgent) {
    const ci = allAgents.find((a) => a.name.toLowerCase() === targetRaw.toLowerCase());
    if (ci) {
      resolvedAgent = ci;
      normalized = true;
    }
  }
  if (!resolvedAgent) {
    return { kind: "unknown_target", target: targetRaw };
  }

  // Workflow-neighborhood check — only when the caller supplied the refusing
  // agent and that agent is DAG-typed with a non-empty neighborhood.
  const activeAgent = opts.activeAgent;
  if (activeAgent && activeAgent.name !== resolvedAgent.name && hasAgencyTyping(activeAgent)) {
    const neighbors = dagNeighbors(activeAgent, allAgents);
    if (neighbors.length > 0 && !neighbors.some((a) => a.name === resolvedAgent.name)) {
      return {
        kind: "geometry_violation",
        geometry: "dag",
        target: resolvedAgent.name,
        ...(normalized ? { normalized: true } : {}),
        dag_neighbors: neighbors.map((a) => a.name).sort(),
        message:
          `${activeAgent.name} refused to ${resolvedAgent.name}, which is in the allowlist but ` +
          `outside the workflow neighborhood [${neighbors.map((a) => a.name).sort().join(", ")}].`,
      };
    }
  }

  return {
    kind: "valid_refusal",
    target: resolvedAgent.name,
    ...(normalized ? { normalized: true } : {}),
  };
}
