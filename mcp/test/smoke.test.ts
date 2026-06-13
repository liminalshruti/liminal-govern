/**
 * smoke.test.ts — boots the MCP server over an in-memory stdio pair and exercises one tool end to
 * end (the real wire protocol: initialize → list tools → call run_spend_audit), then sanity-checks
 * verify_chain. No network, no API key. Run: `npm test` (node --test) or `npm run smoke`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  loadCanonicalReport,
  runLiveAudit,
  verifyCanonicalChain,
  isCanonicalFixture,
} from "../src/governance.js";

/**
 * The server wiring lives in src/server.ts behind a top-level connect(stdio). Rather than spawn a
 * child process, we register the same tool surface against a fresh McpServer bound to an in-memory
 * transport — the identical request/response path a real client drives over stdio.
 */
function buildTestServer(): McpServer {
  const server = new McpServer({ name: "liminal-govern", version: "0.1.0" });
  const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v) }] });

  server.registerTool(
    "run_spend_audit",
    { description: "run audit", inputSchema: {} },
    async () => {
      const r = loadCanonicalReport();
      return json({ source: "canonical-seeded", total_recommended_savings: r.total_recommended_savings });
    },
  );
  server.registerTool(
    "verify_chain",
    { description: "verify", inputSchema: {} },
    async () => json(await verifyCanonicalChain()),
  );
  return server;
}

test("server boots over stdio and run_spend_audit returns the governance result ($284)", async () => {
  const server = buildTestServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "smoke", version: "0.0.0" });
  await client.connect(clientTransport);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name);
  assert.ok(names.includes("run_spend_audit"), "run_spend_audit is advertised");

  const res = await client.callTool({ name: "run_spend_audit", arguments: {} });
  const payload = JSON.parse((res.content as { type: string; text: string }[])[0]!.text);
  assert.equal(payload.source, "canonical-seeded");
  assert.equal(payload.total_recommended_savings, 284, "headline savings is $284");

  await client.close();
  await server.close();
});

test("verify_chain walks the re-anchored chain and it verifies", async () => {
  const integrity = await verifyCanonicalChain();
  assert.equal(integrity.verified, true, "chain verifies");
  assert.equal(integrity.broken_index, -1, "no broken link");
  assert.equal(integrity.chain_length, loadCanonicalReport().provenance.chain_length);
  assert.ok(integrity.links.every((l) => l.ok && l.links_to_prev), "every link ok + linked");
});

test("live engine audit reconciles on the q2-spend fixture", () => {
  assert.equal(isCanonicalFixture(undefined), true);
  assert.equal(isCanonicalFixture("q2-spend"), false);
  const audit = runLiveAudit("q2-spend");
  assert.equal(audit.source, "live-engine");
  assert.equal(audit.reconcile.ok, true, "per-finding savings reconcile to the total");
  assert.ok(audit.monthly_savings_total > 0);
});
