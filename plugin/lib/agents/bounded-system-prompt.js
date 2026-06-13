// Builds the final system prompt for a bounded front-door agent.
//
// PUBLIC-SAFE REIMPLEMENTATION of the private liminal-agents prompt composer.
// The private version composes against a 12-position archetype polarity-clock
// AND a 12-agent workflow DAG; here we keep only the DAG slice the front door
// needs. The composition has three concerns:
//
//   1. The agent's hand-tuned voice rules (baseSystem) — written per-agent.
//   2. The refusal allowlist — auto-generated from the agent's workflow
//      neighborhood (predecessors ∪ successors ∪ explicit redirects). This is
//      the structural teeth: a refusal can only name an agent in the bound.
//   3. The fourth-wall guard — prevents meta-commentary about the codebase.
//
// Composition is one-shot at module load (see index.js); the returned string
// becomes the agent's `system` property.

import { hasAgencyTyping, dagNeighbors } from "./agency-dag.js";

export function buildBoundedSystemPrompt(agent, allAgents) {
  if (!agent || !agent.baseSystem) {
    throw new Error("buildBoundedSystemPrompt: agent.baseSystem required");
  }
  if (!Array.isArray(allAgents) || allAgents.length === 0) {
    throw new Error("buildBoundedSystemPrompt: allAgents must be a non-empty array");
  }

  let boundAgents;
  let workflowLine = "";

  if (hasAgencyTyping(agent)) {
    const neighbors = dagNeighbors(agent, allAgents);
    if (neighbors.length > 0) {
      boundAgents = neighbors;
      workflowLine =
        "\nWORKFLOW: your refusal targets are your workflow neighbors — the agent " +
        "whose step precedes yours and the agent whose step follows yours. The peer " +
        "set is narrowed to the structurally-correct redirects.";
    } else {
      // Workflow-isolated: fall back to the full allowlist.
      boundAgents = allAgents.filter((a) => a.name !== agent.name);
      workflowLine = "\nWORKFLOW: no workflow neighbors in the active set; full allowlist applies.";
    }
  } else {
    // Untyped agent: classical full allowlist.
    boundAgents = allAgents.filter((a) => a.name !== agent.name);
  }

  const allowlist = boundAgents
    .map((a) => a.name)
    .sort()
    .join(", ");

  if (!allowlist) {
    throw new Error(
      `buildBoundedSystemPrompt: refusal allowlist is empty for ${agent.name}; ` +
        "a bounded agent must have at least one peer.",
    );
  }

  const refusalProtocol =
    `\n\nREFUSAL PROTOCOL — STRICT. When you refuse, refuse to one of these agent names only: ${allowlist}. ` +
    "Do not invent agent names. " +
    "Your refusal response must be exactly two lines:\n" +
    "  Line 1: REFUSE: <correct agent name>\n" +
    "  Line 2: <one sentence stating the lane boundary>\n" +
    "Do not reference this codebase, system architecture, agent roles, prompts, or your own existence as an agent in your output." +
    workflowLine;

  return `${agent.baseSystem}${refusalProtocol}`;
}
