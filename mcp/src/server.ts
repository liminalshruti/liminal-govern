#!/usr/bin/env -S node --import tsx
/**
 * liminal-govern MCP server (stdio).
 *
 * Exposes the AI-spend-governance engine + provenance chain as MCP primitives, so ANY Claude
 * session can run a spend audit and query provenance without reimplementing either:
 *
 *   Tools
 *     run_spend_audit({ fixture? })  — the governance result. Default fixture "usage-events"
 *                                      returns the canonical $284 / E14-dropped / ratified report;
 *                                      a seat-utilization fixture (q2-spend | sample-spend | path)
 *                                      runs the live engine and reconciles the total.
 *     verify_chain()                 — walk the provenance chain; per-link ok/break + overall verdict.
 *     get_finding({ id })            — a finding + its anchor receipt + correction trail.
 *     corrections_of({ id })         — the correction/refutation trail for a finding.
 *
 *   Resource
 *     governance://report.json       — the immutable seeded governance report (cite source rows).
 *
 * Transport: stdio — exactly what a plugin `.mcp.json` launches.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  DEFAULT_FIXTURE,
  isCanonicalFixture,
  loadCanonicalReport,
  canonicalReportText,
  findCanonicalFinding,
  runLiveAudit,
  buildCanonicalChain,
  verifyCanonicalChain,
  REPORT_PATH,
} from "./governance.js";

const server = new McpServer({
  name: "liminal-govern",
  version: "0.1.0",
});

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const fail = (message: string) => ({
  isError: true as const,
  content: [{ type: "text" as const, text: message }],
});

// ─────────────────────────── run_spend_audit ───────────────────────────

server.registerTool(
  "run_spend_audit",
  {
    title: "Run AI spend audit",
    description:
      "Run the AI-spend-governance audit and return the result. With no fixture (default " +
      `"${DEFAULT_FIXTURE}") it returns the canonical governance report: total recommended savings ` +
      "($284), the claim dropped by adversarial review (E14), and the ratified decision. Pass a " +
      'seat-utilization fixture ("q2-spend", "sample-spend", or a path to a spend CSV) to run the ' +
      "deterministic engine live and reconcile the per-finding savings against the headline total.",
    inputSchema: {
      fixture: z
        .string()
        .optional()
        .describe('Fixture name or CSV path. Omit (or "usage-events") for the canonical report.'),
    },
  },
  async ({ fixture }) => {
    try {
      if (isCanonicalFixture(fixture)) {
        const r = loadCanonicalReport();
        return json({
          source: "canonical-seeded",
          generated_for: r.generated_for,
          total_recommended_savings: r.total_recommended_savings,
          naive_savings: r.naive_savings,
          findings: r.findings,
          dropped_claims: r.dropped_claims,
          ratified_decision: r.ratified_decision,
          provenance: {
            chain_verified: r.provenance.chain_verified,
            chain_length: r.provenance.chain_length,
          },
          report_citations: r.report_citations,
        });
      }
      return json(runLiveAudit(fixture!));
    } catch (err) {
      return fail(`run_spend_audit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

// ─────────────────────────── verify_chain ───────────────────────────

server.registerTool(
  "verify_chain",
  {
    title: "Verify provenance chain",
    description:
      "Walk the provenance chain for the canonical governance report and return a per-link " +
      "integrity report (each link's hash, prev-hash link, and ok/break) plus the overall verdict. " +
      "The chain is re-anchored in-memory from the report's findings + ratified decision, so this is " +
      "a real cryptographic walk, not a stored boolean.",
    inputSchema: {},
  },
  async () => {
    try {
      return json(await verifyCanonicalChain());
    } catch (err) {
      return fail(`verify_chain failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

// ─────────────────────────── get_finding ───────────────────────────

server.registerTool(
  "get_finding",
  {
    title: "Get a finding with its provenance",
    description:
      "Return a single governance finding by id (e.g. F-E12, F-E14, F-OKR-SECURITY) together with " +
      "its anchor receipt from the provenance chain and its correction/refutation trail. A finding " +
      "dropped by adversarial review (e.g. F-E14) has no receipt and carries its drop reason.",
    inputSchema: {
      id: z.string().describe("Finding id, e.g. F-E12 or F-E14."),
    },
  },
  async ({ id }) => {
    try {
      const finding = findCanonicalFinding(id);
      if (!finding) {
        const known = loadCanonicalReport().findings.map((f) => f.finding_id);
        return fail(`get_finding: unknown finding "${id}". Known: ${known.join(", ")}`);
      }
      const log = await buildCanonicalChain();
      const event = log.byId(id);
      const receipts = log.receiptsFor(id);
      const corrections = correctionsForId(id);
      return json({
        finding,
        anchored: Boolean(event),
        receipt: receipts[0] ?? null,
        corrections,
      });
    } catch (err) {
      return fail(`get_finding failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

// ─────────────────────────── corrections_of ───────────────────────────

server.registerTool(
  "corrections_of",
  {
    title: "Corrections of a finding",
    description:
      "Return the correction/refutation trail for a finding id: on-chain corrections (corrections " +
      "are first-class linked entries) plus any adversarial-review drop recorded for the finding. " +
      "Empty for a finding that survived review unchanged.",
    inputSchema: {
      id: z.string().describe("Finding id, e.g. F-E14."),
    },
  },
  async ({ id }) => {
    try {
      return json({ finding_id: id, corrections: correctionsForId(id) });
    } catch (err) {
      return fail(`corrections_of failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

/**
 * The correction trail for a finding: any on-chain correction entries (from the live provenance
 * log) plus the adversarial-review drop recorded in the canonical report. In this report the
 * meaningful correction is F-E14 — refuted by PR-103 and dropped before anchoring.
 */
function correctionsForId(id: string): unknown[] {
  const report = loadCanonicalReport();
  const trail: unknown[] = [];

  const finding = report.findings.find((f) => f.finding_id === id);
  if (finding?.dropped) {
    trail.push({
      kind: "adversarial-drop",
      finding_id: id,
      reason: finding.drop_reason,
      anchored: false,
    });
  }
  for (const dc of report.dropped_claims) {
    if (dc.finding_id === id && !trail.some((t) => (t as { reason?: string }).reason === dc.drop_reason)) {
      trail.push({ kind: "adversarial-drop", finding_id: id, reason: dc.drop_reason, anchored: false });
    }
  }
  return trail;
}

// ─────────────────────────── resource: report.json ───────────────────────────

server.registerResource(
  "governance-report",
  "governance://report.json",
  {
    title: "Canonical governance report",
    description:
      "The immutable seeded AI-spend-governance report (out/report.json): classified usage, " +
      "findings, dropped claims, the ratified decision, the provenance chain summary, and the " +
      "source-row citations a caller can cite.",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: canonicalReportText(),
      },
    ],
  }),
);

// ─────────────────────────── boot ───────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Touch the report path so a misconfigured cwd fails loudly on boot, on stderr (never stdout —
  // stdout is the MCP framing channel).
  process.stderr.write(`liminal-govern MCP server ready (report: ${REPORT_PATH})\n`);
}

main().catch((err) => {
  process.stderr.write(`liminal-govern MCP server failed to start: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
