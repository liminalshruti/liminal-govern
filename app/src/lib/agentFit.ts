/**
 * Agent-fit data-seam (cockpit · lane E · Build Day 2026-06-13).
 *
 * PRIOR ART: concept reused & restyled from the public `algorand-berlin-2026`
 * trustless-agents surface (agent registry + marketplace + on-chain attestation
 * badges). NOT copied verbatim — adapted to this product: instead of a generic
 * marketplace of arbitrary agents, this is the *bounded* governance swarm
 * (Analyst / SDR / Auditor / Operator) matched to governance tasks, each carrying
 * a trustless attestation that mirrors the contract `AnchorReceipt` proof.
 *
 * In-app data only (mirrors src/lib/contract.ts shapes). Components read through
 * this module; a Phase-3 swap can back it with the live registry + provenance/
 * attestations without touching <AgentFit/>.
 *
 * CONTRACT ALIGNMENT (src/lib/contract.ts):
 *   - AgentCard.read       ↔ AgentRead  (archetype = the lane the agent occupies)
 *   - AgentCard.attestation ↔ AnchorReceipt  (trustless anchor proof per agent)
 *   - FitRecommendation     ↔ "which bounded agent fits which governance task"
 */

import type { AgentRead, AnchorReceipt } from "./contract";

/** A lane in the bounded swarm. Agents may only act inside their lane. */
export type Lane = "diligence" | "outreach" | "operations";

/** One registry entry: a bounded agent, its lane, and a representative read. */
export interface AgentCard {
  /** Stable id used in attestation payloads + fit pointers. */
  agent_id: string;
  /** Human label. */
  agent_name: string;
  /** The lane / register the agent occupies (contract: AgentRead.archetype). */
  lane: Lane;
  /** One-line scope — what the agent is allowed to do. */
  scope: string;
  /** Out-of-lane guardrail — what it will refuse (mirrors AgentRead.refusal). */
  refuses: string;
  /** A representative AgentRead, so the registry shows the contract shape. */
  read: AgentRead;
  /** Trustless attestation: an AnchorReceipt-style anchor proof for this agent. */
  attestation: AnchorReceipt;
}

/** A governance task and the bounded agent that best fits it. */
export interface FitRecommendation {
  task_id: string;
  task: string;
  /** The lane the task lives in. */
  lane: Lane;
  /** agent_id of the recommended bounded agent. */
  fit_agent_id: string;
  /** Why this agent fits (lane match + capability). */
  rationale: string;
  /** 0–100 fit confidence (in-app, deterministic). */
  fit_score: number;
}

// ───────────────────────── deterministic attestation ─────────────────────────

const ATTESTED_AT = "2026-06-13T09:00:00.000Z";

/** Tiny stable string→hex hash (stand-in for SHA-256). Mirrors provenance.ts. */
function pseudoHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return hex.repeat(8).slice(0, 64);
}

/**
 * Build a trustless attestation for an agent — an AnchorReceipt over the agent's
 * identity + lane. Local-first by default; one agent is anchored on Algorand
 * testnet to show the on-chain path (mirrors the contract anchor_chain union).
 */
function attest(
  agentId: string,
  lane: Lane,
  prevHash: string | null,
  onChain: boolean,
): AnchorReceipt {
  const payload = `agent:${agentId}|lane:${lane}|${ATTESTED_AT}`;
  const hash = pseudoHash(payload);
  return {
    packet_id: `agent:${agentId}`,
    packet_hash: hash,
    prev_hash: prevHash,
    anchored_at: ATTESTED_AT,
    anchor_chain: onChain ? "algorand" : "local",
    anchor_network: onChain ? "testnet" : "local-first",
    ...(onChain ? { anchor_txn_id: pseudoHash(`txn:${hash}`) } : {}),
  };
}

// ───────────────────────── the bounded registry ─────────────────────────

interface Seed {
  agent_id: string;
  agent_name: string;
  lane: Lane;
  scope: string;
  refuses: string;
  quoted: string;
  situation: string;
  hidden_risk: string;
  next_move: string;
  onChain?: boolean;
}

const SEEDS: Seed[] = [
  {
    agent_id: "auditor",
    agent_name: "Auditor",
    lane: "diligence",
    scope: "Reconciles spend ⋈ seat activity and emits findings with cited evidence.",
    refuses: "Won't negotiate with vendors or apply caps — emits, never acts.",
    quoted: "Notion shows 18% seat utilization over the last 30 days.",
    situation: "Reconciled purchased vs. active seats across the spend ledger.",
    hidden_risk: "Seat sprawl compounds monthly; inactive seats keep billing.",
    next_move: "Flag the gap as a finding and cite the source rows.",
    onChain: true,
  },
  {
    agent_id: "analyst",
    agent_name: "Analyst",
    lane: "diligence",
    scope: "Baselines spend against OKRs and surfaces where cost outruns outcomes.",
    refuses: "Won't draft outreach or change ratified caps — reasons, never acts.",
    quoted: "AI tooling is 31% of spend but maps to one shipped OKR.",
    situation: "Compared category spend to the quarter's stated objectives.",
    hidden_risk: "Untracked spend drifts away from the operating plan.",
    next_move: "Recommend a category baseline the operator can ratify.",
  },
  {
    agent_id: "sdr",
    agent_name: "SDR",
    lane: "outreach",
    scope: "Drafts vendor right-size / renegotiation outreach from a finding.",
    refuses: "Won't decide the cap or send without operator ratification.",
    quoted: "Linear renewal is in 12 days at the current seat count.",
    situation: "Read the finding's recommended action and renewal window.",
    hidden_risk: "Auto-renew locks in over-provisioned seats for another term.",
    next_move: "Draft a downgrade request the operator can review and send.",
  },
  {
    agent_id: "operator",
    agent_name: "Operator",
    lane: "operations",
    scope: "Applies ratified caps, schedules reviews, and records the decision.",
    refuses: "Won't act on an un-ratified finding — waits for the signed call.",
    quoted: "A $12k/mo cap was ratified; three vendors exceed their allocation.",
    situation: "Read the ratified governance state and current allocations.",
    hidden_risk: "Caps without enforcement drift back to baseline within a quarter.",
    next_move: "Apply the cap, schedule the next review, log the entry.",
  },
];

/** Materialize the registry with hash-linked attestations (a per-agent chain). */
function buildRegistry(): AgentCard[] {
  let prevHash: string | null = null;
  return SEEDS.map((s, i) => {
    const attestation = attest(s.agent_id, s.lane, prevHash, Boolean(s.onChain));
    prevHash = attestation.packet_hash;
    const card: AgentCard = {
      agent_id: s.agent_id,
      agent_name: s.agent_name,
      lane: s.lane,
      scope: s.scope,
      refuses: s.refuses,
      read: {
        agent_name: s.agent_name,
        archetype: s.lane,
        quoted: s.quoted,
        situation: s.situation,
        hidden_risk: s.hidden_risk,
        next_move: s.next_move,
        ordinal: i,
      },
      attestation,
    };
    return card;
  });
}

const REGISTRY = buildRegistry();

// ─────────────────────── fit recommendations (lane match) ───────────────────────

const TASKS: Omit<FitRecommendation, "fit_agent_id" | "fit_score">[] = [
  {
    task_id: "find-underutilization",
    task: "Find underutilized vendors from spend + activity",
    lane: "diligence",
    rationale: "Diligence lane: reconciles raw activity into cited findings.",
  },
  {
    task_id: "baseline-okrs",
    task: "Baseline category spend against quarterly OKRs",
    lane: "diligence",
    rationale: "Diligence lane: reasons over plan vs. spend, no action taken.",
  },
  {
    task_id: "draft-renegotiation",
    task: "Draft a vendor right-size / renewal renegotiation",
    lane: "outreach",
    rationale: "Outreach lane: drafts the ask but never sends unilaterally.",
  },
  {
    task_id: "apply-cap",
    task: "Apply a ratified cap and schedule the next review",
    lane: "operations",
    rationale: "Operations lane: acts only on a signed, ratified decision.",
  },
];

/**
 * Recommend a bounded agent per task by lane match. When two agents share a lane,
 * the one whose scope keywords overlap the task wins the higher fit_score.
 */
function recommend(): FitRecommendation[] {
  return TASKS.map((t) => {
    const inLane = REGISTRY.filter((a) => a.lane === t.lane);
    const scored = inLane
      .map((a) => ({ a, score: scoreFit(t.task, a) }))
      .sort((x, y) => y.score - x.score);
    const best = scored[0];
    return {
      ...t,
      fit_agent_id: best.a.agent_id,
      fit_score: best.score,
    };
  });
}

/** Deterministic fit score: lane match (base 70) + scope keyword overlap. */
function scoreFit(task: string, agent: AgentCard): number {
  const words = new Set(
    task.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).filter((w) => w.length > 3),
  );
  const hay = `${agent.scope} ${agent.read.next_move}`.toLowerCase();
  let overlap = 0;
  for (const w of words) if (hay.includes(w)) overlap += 1;
  return Math.min(99, 70 + overlap * 6);
}

const RECOMMENDATIONS = recommend();

// ───────────────────────────── seam (stable API) ─────────────────────────────

export function listAgents(): AgentCard[] {
  return REGISTRY;
}

export function listFitRecommendations(): FitRecommendation[] {
  return RECOMMENDATIONS;
}

export function getAgent(agentId: string): AgentCard | undefined {
  return REGISTRY.find((a) => a.agent_id === agentId);
}

/** Verify the per-agent attestation chain links cleanly (prev_hash ↔ packet_hash). */
export function verifyAttestations(): { ok: boolean; anchored: number; total: number } {
  let prevHash: string | null = null;
  let ok = true;
  let anchored = 0;
  for (const a of REGISTRY) {
    if (a.attestation.prev_hash !== prevHash) ok = false;
    if (a.attestation.anchor_chain === "algorand") anchored += 1;
    prevHash = a.attestation.packet_hash;
  }
  return { ok, anchored, total: REGISTRY.length };
}
