/**
 * governance.ts — the single seam between the MCP server and the liminal-govern libs.
 *
 * Two layers are exposed, both real:
 *
 *  1. LIVE ENGINE  — `runLiveAudit(fixture)` calls the engine's deterministic seat-utilization
 *     analyze() over a spend fixture (q2-spend | sample-spend | a CSV path) and reconciles the
 *     per-finding savings against the headline total. Rerunnable on fresh data.
 *
 *  2. CANONICAL     — `loadCanonicalReport()` returns the immutable, committed AI-spend-governance
 *     result (out/report.json): the $284 total, the E14 claim dropped by adversarial review, and
 *     the ratified decision. `buildCanonicalChain()` re-anchors that report's findings + decision
 *     into a real, hash-linked provenance chain (in-memory) so the chain can be walked and verified
 *     live — exercising ProvenanceLog.verifyChain / byId / receiptsFor / correctionsOf for real.
 *
 * Everything the MCP server needs goes through here, so there is exactly one place that knows where
 * the engine + provenance libs live on disk.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Engine: deterministic analyze + reconcile (no @anthropic-ai/sdk on this path).
import { analyze } from "../../engine/src/analyze.js";
import { reconcileFindings } from "../../engine/src/anchor.js";

// Provenance lib (built dist — same concrete path the engine imports).
import {
  ProvenanceLog,
  ingestPacket,
} from "../../provenance/dist/src/index.js";
import type {
  Packet,
  AgentRead,
} from "../../provenance/dist/src/index.js";

const REPORT_URL = new URL("../../out/report.json", import.meta.url);
export const REPORT_PATH = fileURLToPath(REPORT_URL);

/** The default fixture: the AI-spend usage events that produced the canonical governance report. */
export const DEFAULT_FIXTURE = "usage-events";

/** Names that resolve to the canonical seeded report rather than a live seat-utilization run. */
const CANONICAL_ALIASES = new Set(["usage-events", "usage-events.csv", "canonical", "report", "default"]);

export function isCanonicalFixture(fixture?: string): boolean {
  if (!fixture) return true;
  const name = fixture.replace(/^.*\//, "").replace(/\.csv$/i, "");
  return CANONICAL_ALIASES.has(name) || CANONICAL_ALIASES.has(fixture);
}

// ─────────────────────────── canonical (seeded) report ───────────────────────────

export interface CanonicalReport {
  generated_for: string;
  total_recommended_savings: number;
  naive_savings: number;
  findings: CanonicalFinding[];
  dropped_claims: { finding_id: string; drop_reason: string }[];
  ratified_decision: Record<string, unknown>;
  provenance: {
    chain_verified: boolean;
    chain_length: number;
    anchored: AnchoredEntry[];
    db: string;
  };
  report_citations: string[];
  [k: string]: unknown;
}

export interface CanonicalFinding {
  finding_id: string;
  type: string;
  recommended_action: string;
  monthly_savings: number;
  source_row_ids: string[];
  dropped?: boolean;
  drop_reason?: string;
  [k: string]: unknown;
}

interface AnchoredEntry {
  packet_id: string;
  packet_hash: string;
  prev_hash: string | null;
  anchor_chain: string;
  anchor_network: string;
}

let _report: CanonicalReport | null = null;

/** Load + cache the immutable canonical governance report (out/report.json). */
export function loadCanonicalReport(): CanonicalReport {
  if (!_report) {
    _report = JSON.parse(readFileSync(REPORT_PATH, "utf8")) as CanonicalReport;
  }
  return _report;
}

/** Raw report text — used to back the read-only MCP Resource. */
export function canonicalReportText(): string {
  return readFileSync(REPORT_PATH, "utf8");
}

/** Find a finding by id across surviving + dropped findings. */
export function findCanonicalFinding(id: string): CanonicalFinding | undefined {
  return loadCanonicalReport().findings.find((f) => f.finding_id === id);
}

// ─────────────────────────── live engine audit ───────────────────────────

export interface LiveAudit {
  source: "live-engine";
  fixture: string;
  rows_analyzed: number;
  utilization: unknown[];
  findings: unknown[];
  monthly_savings_total: number;
  reconcile: ReturnType<typeof reconcileFindings>;
}

/** Run the engine over a seat-utilization fixture and reconcile the total. Deterministic + rerunnable. */
export function runLiveAudit(fixture: string): LiveAudit {
  const report = analyze(fixture);
  const reconcile = reconcileFindings(report.findings, report.monthly_savings_total);
  return {
    source: "live-engine",
    fixture: report.fixture,
    rows_analyzed: report.rows_analyzed,
    utilization: report.utilization,
    findings: report.findings,
    monthly_savings_total: report.monthly_savings_total,
    reconcile,
  };
}

// ─────────────────────────── live provenance chain ───────────────────────────

// Deterministic anchor timestamps so the live chain re-derives byte-identically every boot.
const CHAIN_EPOCH = Date.parse("2026-06-01T00:00:00.000Z");

/** Build a finding/decision packet from a canonical report entry. */
function packetFor(entry: AnchoredEntry, index: number): Packet {
  const created_at = new Date(CHAIN_EPOCH + index * 1000).toISOString();
  const report = loadCanonicalReport();
  const finding = report.findings.find((f) => f.finding_id === entry.packet_id);

  if (finding) {
    const read: AgentRead = {
      agent_name: "spend-auditor",
      archetype: "auditor",
      quoted: finding.recommended_action,
      situation: `${finding.type} finding citing ${finding.source_row_ids.join(", ")}`,
      hidden_risk: "Unaligned Opus spend renews silently until governed.",
      next_move: finding.recommended_action,
      ordinal: index,
    };
    return {
      id: entry.packet_id,
      kind: "finding",
      context: JSON.stringify({
        finding_id: finding.finding_id,
        type: finding.type,
        source_row_ids: finding.source_row_ids,
        monthly_savings: finding.monthly_savings,
      }),
      reads: [read],
      created_at,
    };
  }

  // Not a finding → the ratified decision packet (D-RATIFY-CAL).
  return {
    id: entry.packet_id,
    kind: "finding",
    context: JSON.stringify(report.ratified_decision),
    reads: [],
    created_at,
  };
}

export interface ChainLink {
  index: number;
  id: string;
  kind: string;
  packet_hash: string;
  prev_hash: string | null;
  links_to_prev: boolean;
  ok: boolean;
}

export interface ChainIntegrity {
  source: "live-provenance";
  basis: string;
  verified: boolean;
  chain_length: number;
  broken_index: number;
  reason?: string;
  links: ChainLink[];
}

let _chain: ProvenanceLog | null = null;

/**
 * Build (once, cached) a real hash-linked provenance chain from the canonical report's anchored
 * findings + ratified decision. Returns an open ProvenanceLog whose entries can be walked,
 * verified, and queried by id. In-memory — nothing is written to disk.
 */
export async function buildCanonicalChain(): Promise<ProvenanceLog> {
  if (_chain) return _chain;
  const log = new ProvenanceLog(":memory:");
  const anchored = loadCanonicalReport().provenance.anchored;
  for (let i = 0; i < anchored.length; i++) {
    await ingestPacket(log, packetFor(anchored[i]!, i));
  }
  _chain = log;
  return log;
}

/** Walk the live chain and return a per-link integrity report. */
export async function verifyCanonicalChain(): Promise<ChainIntegrity> {
  const log = await buildCanonicalChain();
  const verify = log.verifyChain();
  const rows = log.all();
  let prev: string | null = null;
  const links: ChainLink[] = rows.map((row, i) => {
    const links_to_prev = row.prev_hash === prev;
    const ok = verify.brokenIndex === -1 || i < verify.brokenIndex;
    prev = row.packet_hash;
    return {
      index: i,
      id: row.id,
      kind: row.kind,
      packet_hash: row.packet_hash,
      prev_hash: row.prev_hash,
      links_to_prev,
      ok,
    };
  });
  return {
    source: "live-provenance",
    basis: "canonical report findings + ratified decision (out/report.json), re-anchored in-memory",
    verified: verify.ok,
    chain_length: verify.length,
    broken_index: verify.brokenIndex,
    ...(verify.ok ? {} : { reason: verify.reason }),
    links,
  };
}
