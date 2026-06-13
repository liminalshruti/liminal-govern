/**
 * Bounded front-door agent registry (Analyst / SDR / Auditor).
 *
 * PUBLIC-SAFE REIMPLEMENTATION of the private liminal-agents agent registry.
 * The private substrate ships two 12-agent sets (an introspective polarity
 * clock + a workflow-DAG agency set) over a SQLCipher vault. The front door
 * needs only the three agency agents that demonstrate the loop, composed with
 * the bounded-refusal protocol, run in parallel, with partial-failure
 * tolerance. None of the private internals are imported.
 */

import { analyst, sdr, auditor } from "./defs.js";
import { buildBoundedSystemPrompt } from "./bounded-system-prompt.js";
import { classifyInterpretation } from "./validation.js";

const AGENCY_DEFS = [analyst, sdr, auditor];

// Compose each agent's final `system` prompt = baseSystem + bounded refusal
// protocol (allowlist derived from its workflow neighborhood).
export const AGENCY_AGENTS = AGENCY_DEFS.map((agent) => ({
  ...agent,
  system: buildBoundedSystemPrompt(agent, AGENCY_DEFS),
}));

export const AGENCY_AGENT_NAMES = AGENCY_AGENTS.map((a) => a.name);

// Front-door default set === the agency set (no introspective set here).
export const AGENTS = AGENCY_AGENTS;
export const AGENT_NAMES = AGENCY_AGENT_NAMES;

// Opus is mandatory for the bounded agents (matches agents/*.md `model: opus`).
// Full id for the SDK; the `claude` CLI also accepts it (and the `opus` alias).
export const OPUS_MODEL = "claude-opus-4-8";

// ── runAgent ──────────────────────────────────────────────────────────────
// Throws on empty content so allSettled in runAllAgents can capture it.
export async function runAgent(client, agent, state, context, model = OPUS_MODEL) {
  const response = await client.messages.create({
    model,
    max_tokens: 600,
    temperature: 1.0,
    system: agent.system,
    messages: [{ role: "user", content: agent.task(state, context) }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  const text = (textBlock?.text || "").trim();

  if (!text) {
    throw new Error(
      `agent ${agent.name}: no text in API response ` +
        `(stop_reason=${response.stop_reason || "unknown"})`,
    );
  }

  const classification = classifyInterpretation(text, AGENCY_AGENTS, { activeAgent: agent });
  if (classification.kind === "malformed_refusal") {
    console.warn(`[runAgent ${agent.name}] malformed refusal: ${classification.reason}`);
  } else if (classification.kind === "unknown_target") {
    console.warn(`[runAgent ${agent.name}] refusal names unknown agent "${classification.target}"`);
  } else if (classification.kind === "geometry_violation") {
    console.warn(`[runAgent ${agent.name}] ${classification.message}`);
  }

  return {
    name: agent.name,
    register: agent.register || null,
    interpretation: text,
    classification: classification.kind,
  };
}

/**
 * Run a set of agents in parallel against the same state + context.
 *
 * Returns { byName, errors }. Uses Promise.allSettled so a single agent's
 * failure does not lose the others' work.
 *
 * @param {object}  client   Anthropic-like client (.messages.create).
 * @param {string}  state    User state / brief text.
 * @param {string?} context  Optional extra context.
 * @param {object?} opts     { agents?, model? }. Defaults to AGENCY_AGENTS / OPUS_MODEL.
 */
export async function runAllAgents(client, state, context, opts = {}) {
  const agents = opts.agents || AGENTS;
  const model = opts.model || OPUS_MODEL;

  const results = await Promise.allSettled(
    agents.map((a) => runAgent(client, a, state, context, model)),
  );

  const byName = {};
  const errors = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const agent = agents[i];

    if (result.status === "fulfilled") {
      byName[agent.name] = result.value;
    } else {
      const reason = result.reason?.message || String(result.reason);
      errors.push({ agent_name: agent.name, reason });
      byName[agent.name] = {
        name: agent.name,
        register: agent.register || null,
        interpretation: "",
        error: true,
        error_reason: reason,
      };
      console.error(`[runAllAgents] ${agent.name} failed: ${reason}`);
    }
  }

  return { byName, errors };
}

export { analyst, sdr, auditor, buildBoundedSystemPrompt, classifyInterpretation };
