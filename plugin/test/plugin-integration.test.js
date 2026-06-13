// Plugin-integration tests — the Liminal front door (vendored into liminal-govern).
//
// These exercise the plugin seam the front-door demo depends on, fully offline
// (no Anthropic credential required):
//
//   1. Manifest + components — plugin.json declares the expected surfaces and
//      the bounded subagents ship with model:opus and a tight tools allowlist.
//   2. Skill invocation — the /try-liminal runner produces a deliberation row
//      and renders the disagreement beat (in-lane work + out-of-lane refusals)
//      via the bundled fixture when no backend is reachable.
//   3. Vault access — the runner writes a real deliberation + agent_views into
//      a throwaway PLAIN taste vault we can open and read back.
//   4. Refusal on an out-of-lane prompt — the bounded prompt + classifier label
//      a REFUSE: line as a valid refusal and reject invented targets.
//   5. Correction round-trip — store-correction.js writes a tagged correction
//      against the deliberation, and we read it back from the vault.
//
// The runner is forced into fixture mode by running it with a PATH that has
// node but no `claude` binary and no API key, so the client falls back to the
// fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { AGENCY_AGENTS } from "../lib/agents/index.js";
import { classifyInterpretation } from "../lib/agents/validation.js";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NODE = process.execPath;

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, "agent file missing YAML frontmatter");
  const out = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

// Run the /try-liminal runner with a sanitized PATH (node present, claude
// absent) and no credentials, forcing the offline fixture path.
function runTryLiminalFixture() {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "liminal-bin-"));
  fs.symlinkSync(NODE, path.join(binDir, "node"));
  try {
    const stdout = execFileSync(NODE, [path.join(PLUGIN_ROOT, "skills/try-liminal/run.js")], {
      env: {
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR || "/tmp",
        PATH: binDir, // node only — no `claude`, so the CLI shim spawn fails
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(stdout);
  } finally {
    fs.rmSync(binDir, { recursive: true, force: true });
  }
}

// ─── 1 — Manifest + bounded subagents ─────────────────────────────────────

test("plugin manifest declares the front-door surfaces and consent gate", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PLUGIN_ROOT, ".claude-plugin/plugin.json"), "utf8"),
  );
  assert.equal(manifest.name, "liminal-govern");
  assert.equal(
    manifest.defaultEnabled,
    false,
    "install must require explicit consent — defaultEnabled:false",
  );
  assert.ok(manifest.hooks, "manifest must reference the SessionStart hooks file");
  assert.ok(Array.isArray(manifest.agents), "manifest must list bounded subagents");
  assert.equal(manifest.skills, "./skills/", "manifest must expose the skills dir");

  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "hooks/hooks.json"), "utf8"));
  assert.ok(Array.isArray(hooks.hooks?.SessionStart), "SessionStart hook missing");
  const cmd = hooks.hooks.SessionStart[0].hooks[0].command;
  assert.match(cmd, /liminal-plugin-onboard\.js/, "SessionStart must run the onboarder");
});

test("bounded subagents ship with model:opus and a tight tools allowlist (refusal mechanism)", () => {
  const analyst = parseFrontmatter(
    fs.readFileSync(path.join(PLUGIN_ROOT, "agents/liminal-analyst.md"), "utf8"),
  );
  const auditor = parseFrontmatter(
    fs.readFileSync(path.join(PLUGIN_ROOT, "agents/liminal-auditor.md"), "utf8"),
  );

  assert.equal(analyst.model, "opus", "Analyst must run on Opus");
  assert.equal(auditor.model, "opus", "Auditor must run on Opus");

  // Analyst = Read,Bash; Auditor = Read only (judges, never produces). The
  // narrow tools allowlist is the refusal mechanism at the tool layer.
  assert.equal(analyst.tools.replace(/\s/g, ""), "Read,Bash");
  assert.equal(auditor.tools.replace(/\s/g, ""), "Read");

  const analystBody = fs.readFileSync(path.join(PLUGIN_ROOT, "agents/liminal-analyst.md"), "utf8");
  assert.match(analystBody, /REFUSAL PROTOCOL — STRICT/);
  assert.match(analystBody, /Line 1: REFUSE: <correct agent name>/);
});

// ─── 2 + 3 — Skill invocation + vault access ──────────────────────────────

test("/try-liminal runner renders disagreement + refusal and writes a deliberation", () => {
  const result = runTryLiminalFixture();

  assert.equal(result.mode, "fixture", "no credential present → fixture beat");
  assert.ok(result.vault_id, "runner must return a deliberation vault_id");
  assert.ok(result.vault_dir, "runner must report the taste vault dir");

  // The disagreement beat: in-lane Analyst produces work; SDR + Auditor refuse.
  assert.equal(result.analyst.refused, false, "Analyst is in lane — must work");
  assert.ok(result.analyst.interpretation.length > 0, "Analyst produced no work");
  assert.equal(result.sdr.refused, true, "SDR must refuse the teardown");
  assert.equal(result.auditor.refused, true, "Auditor must refuse the teardown");

  // The taste vault is a real plain SQLite file on disk — not an in-memory mock.
  const dbFile = path.join(result.vault_dir, "vault.db");
  assert.ok(fs.existsSync(dbFile), "taste vault.db must exist on disk");
});

// ─── 4 — Refusal on an out-of-lane prompt ─────────────────────────────────

test("out-of-lane refusal is classified valid; invented targets rejected", () => {
  // The SDR is asked for a teardown (Analyst's lane). A correct refusal names
  // an agent inside the SDR's bound; the classifier accepts it.
  const sdrRefusal = "REFUSE: Analyst\nA competitive teardown is research, not outreach.";
  const ok = classifyInterpretation(sdrRefusal, AGENCY_AGENTS);
  assert.equal(ok.kind, "valid_refusal");
  assert.equal(ok.target, "Analyst");

  // An invented agent name must NOT pass — the structural teeth on bounded
  // refusal. If this regresses, bounded refusal weakens to convention.
  const invented = classifyInterpretation("REFUSE: Synthesizer\nNot a real agent.", AGENCY_AGENTS);
  assert.equal(invented.kind, "unknown_target");

  // Every shipped bounded subagent prompt names only real agents in its
  // allowlist phrase.
  const realNames = new Set(AGENCY_AGENTS.map((a) => a.name));
  for (const f of ["liminal-analyst.md", "liminal-auditor.md", "liminal-sdr.md"]) {
    const body = fs.readFileSync(path.join(PLUGIN_ROOT, "agents", f), "utf8");
    const m = body.match(/refuse to one of these agent names only:\s*([^.]+)\./);
    assert.ok(m, `${f} missing allowlist phrase`);
    for (const name of m[1].split(",").map((s) => s.trim())) {
      assert.ok(realNames.has(name), `${f} allowlist names non-agent "${name}"`);
    }
  }
});

// ─── 5 — Correction round-trip ────────────────────────────────────────────

test("correction round-trip: store a tagged correction against a deliberation and read it back", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "liminal-corr-"));
  process.env.LIMINAL_VAULT_DIR = dir;

  try {
    const { openVault } = await import("../lib/vault/db.js");
    const { newId } = await import("../lib/vault/ids.js");

    // Seed a deliberation the correction can hang off.
    const db = openVault();
    const delibId = newId();
    db.prepare(
      `INSERT INTO deliberations (id, timestamp, trigger, signal_ids, user_state, schema_version, vault_origin)
       VALUES (?, ?, 'check', '[]', ?, 1, 'native')`,
    ).run(delibId, Date.now(), "teardown of notion.so");
    db.close();

    // Store a correction through the same CLI the SKILL calls. The front-door
    // surface produces Analyst/SDR/Auditor reads, so a correction against
    // "Analyst" MUST be accepted.
    execFileSync(
      NODE,
      [
        path.join(PLUGIN_ROOT, "skills/check/store-correction.js"),
        delibId,
        "Analyst",
        "too_generic",
        "the teardown could apply to any SaaS, not Notion specifically",
      ],
      { env: { ...process.env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    // Read it back.
    const db2 = openVault();
    const row = db2.prepare("SELECT * FROM corrections WHERE deliberation_id = ?").get(delibId);
    db2.close();

    assert.ok(row, "correction row must exist after store-correction");
    assert.equal(row.agent, "Analyst", "front-door agent must be accepted");
    assert.equal(row.tag, "too_generic");
    assert.match(row.reason, /any SaaS/);
  } finally {
    delete process.env.LIMINAL_VAULT_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
