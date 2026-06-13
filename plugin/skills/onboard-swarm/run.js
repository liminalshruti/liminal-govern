#!/usr/bin/env node
/**
 * /onboard-swarm — the parallel per-agent context scan that beats cold-start.
 *
 * Runs the lightweight onboarding swarm (lib/onboard/swarm.js): each bounded
 * agent scans its canonical context stream in parallel and reports the candidate
 * streams it can pull from, before any deliberation. No LLM calls, no vault
 * writes — just "what's here, and which agent owns it."
 *
 * Output: JSON { summary, streams } where each stream is
 *   { source, agent_owner, status, detail, count }.
 */

import { scanStreams } from "../../lib/onboard/swarm.js";

async function main() {
  const result = await scanStreams();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("ERROR in /onboard-swarm scan:", err.message);
  process.exit(1);
});
