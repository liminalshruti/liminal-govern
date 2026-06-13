#!/usr/bin/env node
/**
 * /onboard-swarm — the parallel per-agent swarm that beats cold-start.
 *
 * Two modes:
 *   (default) full deliberation bootstrap — each bounded agent READS its
 *     canonical source and POSTS A CANDIDATE (the one fact / commitment / risk
 *     worth acting on), in parallel under Promise.allSettled. Read-only,
 *     LLM-optional (labeled fixture fallback when no Anthropic credential).
 *   --scan  lightweight candidate-stream scan only (no agent reads) — the
 *     "what's here?" probe.
 *
 * Output (default): JSON { mode, summary, candidates } where each candidate is
 *   { source, agent_owner, status, interpretation, refused, mode }.
 * Output (--scan):  JSON { summary, streams }.
 */

import { scanStreams, bootstrapSwarm } from "../../lib/onboard/swarm.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--scan")) {
    console.log(JSON.stringify(await scanStreams(), null, 2));
    return;
  }
  const result = await bootstrapSwarm({
    forceFixture: args.includes("--fixture"),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("ERROR in /onboard-swarm:", err.message);
  process.exit(1);
});
