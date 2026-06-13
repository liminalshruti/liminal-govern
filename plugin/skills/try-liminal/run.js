#!/usr/bin/env node
/**
 * /try-liminal — the 60-second taste.
 *
 * Runs ONE bounded deliberation (Analyst / SDR / Auditor) on a built-in sample
 * brief, so a first-time user sees the loop without bringing their own task:
 * three agents read the same brief, at least one refuses out-of-lane, the
 * in-lane agent does the work. The SKILL then captures one correction and
 * prints the conversion line.
 *
 * Side-effect-light by design:
 *   - It writes ONE deliberation row to a PLAIN taste vault (a throwaway temp
 *     dir by default, so a first run never touches anything persistent unless
 *     the user opts in with LIMINAL_TRY_REAL_VAULT=1 / LIMINAL_VAULT_DIR).
 *   - It does NOT install anything. Install is the desktop app (SessionStart).
 *
 * If no Anthropic credential / `claude` CLI is available, it falls back to a
 * baked-in fixture so the demo beat (disagreement + refusal) always renders.
 * The fixture is clearly labeled so we never imply a live read happened when
 * it didn't.
 *
 * Usage:   node skills/try-liminal/run.js [optional brief override]
 * Output:  JSON { vault_id, brief, mode, analyst, sdr, auditor }
 *
 * PUBLIC-SAFE: no secrets; the key (if any) is read from the environment by
 * lib/auth.js and handed straight to the client. The taste vault is plaintext.
 */

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { runAllAgents, AGENCY_AGENTS } from "../../lib/agents/index.js";
import { makeClient } from "../../lib/anthropic-client.js";
import { openVault } from "../../lib/vault/db.js";
import { newId } from "../../lib/vault/ids.js";

// A brief squarely in the Analyst's lane (competitive teardown) so the SDR and
// Auditor have a clean reason to refuse — the disagreement is the point.
const SAMPLE_BRIEF =
  "Competitive teardown of notion.so — what's the moat, where is it exposed, what's the one move a challenger should make this quarter.";

const brief = process.argv.slice(2).join(" ").trim() || SAMPLE_BRIEF;

function detectRefusal(text) {
  return /^\s*REFUSE\s*:/.test(text || "");
}

// Baked-in fixture — used only when there is no Anthropic credential / CLI, so
// the taste still renders the disagreement beat offline. Labeled mode:"fixture".
const FIXTURE = {
  Analyst:
    "Notion's moat is the all-in-one workspace lock-in: docs, databases, and wikis sharing one block model, so switching cost compounds with every embedded database a team builds. The exposure is the seam between flexibility and speed — power users hit performance walls on large databases, and the block model that creates lock-in also creates a learning curve that stalls bottoms-up adoption in less technical teams. The challenger move this quarter is not a cheaper Notion; it is a wedge on one job Notion does adequately but not excellently — a fast, opinionated docs-plus-lightweight-database for a single vertical — and winning the seam before Notion's AI features close it. The implication: attack the onboarding curve, not the feature list.",
  SDR:
    "REFUSE: Analyst\nA competitive teardown is research and analysis, not outreach — that is the Analyst's lane.",
  Auditor:
    "REFUSE: Analyst\nProducing the teardown is analysis work, not a readiness judgment — that is the Analyst's lane; bring me the finished teardown and I will tell you if it is ready to act on.",
};

async function main() {
  // Default to a throwaway taste vault so /try-liminal never silently writes
  // into a persistent location on first contact. Opt in with
  // LIMINAL_TRY_REAL_VAULT=1 or by setting LIMINAL_VAULT_DIR explicitly.
  if (!process.env.LIMINAL_TRY_REAL_VAULT && !process.env.LIMINAL_VAULT_DIR) {
    const tasteDir = fs.mkdtempSync(path.join(os.tmpdir(), "liminal-taste-"));
    process.env.LIMINAL_VAULT_DIR = tasteDir;
  }

  const db = openVault();
  const now = Date.now();
  const signalId = newId();
  db.prepare(
    `INSERT INTO signal_events (id, timestamp, source, kind, register, thread_id, content, schema_version, vault_origin)
     VALUES (?, ?, 'try-liminal', 'sample-brief', 'operational', NULL, ?, 1, 'native')`,
  ).run(signalId, now, JSON.stringify({ brief }));

  const deliberationId = newId();
  db.prepare(
    `INSERT INTO deliberations (id, timestamp, trigger, signal_ids, user_state, user_context,
       architect_view, witness_view, contrarian_view, schema_version, vault_origin)
     VALUES (?, ?, 'check', ?, ?, NULL, NULL, NULL, NULL, 1, 'native')`,
  ).run(deliberationId, now, JSON.stringify([signalId]), brief);

  let analystText, sdrText, auditorText, mode;

  const { client } = await makeClient();
  if (client) {
    const { byName } = await runAllAgents(client, brief, null, { agents: AGENCY_AGENTS });
    analystText = byName["Analyst"]?.interpretation || "";
    sdrText = byName["SDR"]?.interpretation || "";
    auditorText = byName["Auditor"]?.interpretation || "";
    // The CLI shim resolves optimistically; if the backend was unreachable at
    // spawn time every read comes back empty. Fall back to the fixture so the
    // taste still renders — labeled honestly as fixture.
    const live = [analystText, sdrText, auditorText].some((t) => t.trim());
    mode = live ? "live" : "fixture";
  } else {
    mode = "fixture";
  }

  if (mode === "fixture") {
    analystText = FIXTURE.Analyst;
    sdrText = FIXTURE.SDR;
    auditorText = FIXTURE.Auditor;
  }

  db.prepare(
    `UPDATE deliberations SET architect_view = ?, witness_view = ?, contrarian_view = ? WHERE id = ?`,
  ).run(analystText, sdrText, auditorText, deliberationId);

  const insertView = db.prepare(
    `INSERT OR REPLACE INTO agent_views (deliberation_id, agent_name, register, interpretation, schema_version)
     VALUES (?, ?, 'Operational', ?, 1)`,
  );
  const tx = db.transaction(() => {
    insertView.run(deliberationId, "Analyst", analystText);
    insertView.run(deliberationId, "SDR", sdrText);
    insertView.run(deliberationId, "Auditor", auditorText);
  });
  tx();

  db.close();

  console.log(
    JSON.stringify(
      {
        vault_id: deliberationId,
        signal_id: signalId,
        brief,
        mode,
        vault_dir: process.env.LIMINAL_VAULT_DIR || null,
        analyst: { interpretation: analystText, refused: detectRefusal(analystText) },
        sdr: { interpretation: sdrText, refused: detectRefusal(sdrText) },
        auditor: { interpretation: auditorText, refused: detectRefusal(auditorText) },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("ERROR in /try-liminal run:", err.message);
  process.exit(1);
});
