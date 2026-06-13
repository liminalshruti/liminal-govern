// Onboarding front-door tests (Stream S2) — the two pieces the install moment
// adds on top of /try-liminal:
//
//   1. Swarm scan (lib/onboard/swarm.js) — the parallel per-agent context scan
//      that beats cold-start. Asserts the bounded geometry (which agent owns
//      which stream), the partial-result contract, and the cold-start summary.
//   2. SessionStart installer (bin/liminal-plugin-onboard.js) — the live web
//      cockpit fallback, DMG open, and idempotency. All offline, exit 0 always.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { scanStreams, bootstrapSwarm } from "../lib/onboard/swarm.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NODE = process.execPath;
const ONBOARD = path.join(REPO_ROOT, "bin/liminal-plugin-onboard.js");

// Run the installer with a clean env (no inherited HOME-derived state) and a
// per-test data dir so idempotency state never leaks between cases.
function runOnboard(env) {
  return execFileSync(NODE, [ONBOARD], {
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
  });
}

// ── Swarm scan ─────────────────────────────────────────────────────────────

test("swarm scan covers every declared stream with the bounded geometry", async () => {
  const { streams } = await scanStreams();
  const byOwner = {};
  for (const s of streams) {
    assert.ok(s.source, "stream has a source");
    assert.ok(["scanning", "pending"].includes(s.status), `valid status: ${s.status}`);
    assert.equal(typeof s.detail, "string");
    assert.equal(typeof s.count, "number");
    (byOwner[s.agent_owner] ||= []).push(s.source);
  }
  // Geometry mirrors the design doc: Analyst owns facts streams, SDR owns
  // commitment streams, Auditor owns the cross-stream seam.
  assert.deepEqual(byOwner.Analyst, ["git", "claude-code"]);
  assert.deepEqual(byOwner.SDR, ["granola", "calendar"]);
  assert.deepEqual(byOwner.Auditor, ["cross-stream"]);
});

test("swarm reports cold-start when no source has signal", async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "liminal-cold-"));
  // Point every source at a location with nothing to scan.
  const overrides = {
    LIMINAL_GIT_REPO: empty, // not a git repo
    LIMINAL_GRANOLA_PATH: path.join(empty, "none.json"), // absent
    HOME: empty, // no ~/.claude/projects
  };
  const saved = Object.fromEntries(
    Object.keys(overrides).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, overrides);
  try {
    const { summary, streams } = await scanStreams();
    assert.equal(summary.cold_start, true);
    assert.equal(summary.streams_live, 0);
    assert.ok(streams.every((s) => s.status === "pending"));
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test("Auditor cross-stream goes live only with >=2 live source streams", async () => {
  // The repo's own working tree has git + claude-code, so the Auditor's seam
  // view should be live here (>=2 live streams). This pins the threshold rule.
  const { streams } = await scanStreams();
  const live = streams.filter((s) => s.status === "scanning" && s.source !== "cross-stream");
  const auditor = streams.find((s) => s.agent_owner === "Auditor");
  assert.equal(auditor.status, live.length >= 2 ? "scanning" : "pending");
});

// ── Full swarm — deliberation bootstrap (fixture path, deterministic) ───────

test("bootstrap posts an in-lane candidate per live source, partial-result safe", async () => {
  // forceFixture keeps it LLM-free and deterministic: no network, no Opus.
  const { mode, candidates, summary } = await bootstrapSwarm({ forceFixture: true });
  assert.equal(mode, "fixture");
  assert.ok(candidates.length >= 1, "at least one candidate posted");
  for (const c of candidates) {
    assert.equal(c.status, "ingested");
    assert.equal(c.mode, "fixture");
    assert.equal(c.refused, false, "owning agent works its own source, not refuses");
    assert.ok(c.interpretation.length > 0);
    assert.ok(["Analyst", "SDR", "Auditor"].includes(c.agent_owner));
  }
  // Candidates are owned in lane: cross-stream is the Auditor's, source streams
  // never belong to the Auditor.
  const auditorSources = candidates.filter((c) => c.agent_owner === "Auditor");
  for (const c of auditorSources) assert.equal(c.source, "cross-stream");
  assert.equal(summary.candidates_total, candidates.length);
});

test("bootstrap adds the Auditor cross-stream candidate only with >=2 source candidates", async () => {
  const { candidates } = await bootstrapSwarm({ forceFixture: true });
  const sourceCands = candidates.filter((c) => c.source !== "cross-stream");
  const hasAuditor = candidates.some((c) => c.source === "cross-stream");
  assert.equal(hasAuditor, sourceCands.length >= 2);
});

test("bootstrap reports cold when no source has signal", async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "liminal-cold-"));
  const overrides = {
    LIMINAL_GIT_REPO: empty,
    LIMINAL_GRANOLA_PATH: path.join(empty, "none.json"),
    HOME: empty,
  };
  const saved = Object.fromEntries(
    Object.keys(overrides).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, overrides);
  try {
    const { mode, candidates, summary } = await bootstrapSwarm({ forceFixture: true });
    assert.equal(mode, "cold");
    assert.equal(candidates.length, 0);
    assert.equal(summary.cold_start, true);
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

// ── SessionStart installer ───────────────────────────────────────────────────

test("installer falls back to the live cockpit when no DMG is built", () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "liminal-onb-"));
  try {
    const out = runOnboard({
      LIMINAL_ONBOARD_DATA_DIR: data,
      LIMINAL_DESKTOP_REPO: path.join(data, "no-such-repo"),
    });
    assert.match(out, /DMG not yet built/);
    assert.match(out, /liminal-govern-cockpit\.vercel\.app/);
  } finally {
    fs.rmSync(data, { recursive: true, force: true });
  }
});

test("installer is a graceful no-op when DMG absent and cockpit disabled", () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "liminal-onb-"));
  try {
    const out = runOnboard({
      LIMINAL_ONBOARD_DATA_DIR: data,
      LIMINAL_DESKTOP_REPO: path.join(data, "no-such-repo"),
      LIMINAL_COCKPIT_URL: "none",
    });
    assert.match(out, /DMG not yet built/);
    assert.doesNotMatch(out, /cockpit/i);
    assert.match(out, /try-liminal/);
  } finally {
    fs.rmSync(data, { recursive: true, force: true });
  }
});

test("installer opens a found DMG once, then is idempotent", () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "liminal-onb-"));
  const dmg = path.join(data, "Liminal_0.1.0_test.dmg");
  fs.writeFileSync(dmg, "stub");
  const env = {
    LIMINAL_ONBOARD_DATA_DIR: data,
    LIMINAL_DMG_PATH: dmg,
    LIMINAL_ONBOARD_DRY_RUN: "1",
  };
  try {
    const first = runOnboard(env);
    assert.match(first, /installer opened/);
    assert.match(first, /Liminal_0\.1\.0_test\.dmg/);
    // Cockpit is still offered alongside the DMG.
    assert.match(first, /liminal-govern-cockpit\.vercel\.app/);

    const second = runOnboard(env);
    assert.match(second, /already offered/);
    assert.doesNotMatch(second, /installer opened/);

    const state = JSON.parse(
      fs.readFileSync(path.join(data, "onboard-state.json"), "utf8"),
    );
    assert.ok(state.installedGeneration, "state records the install generation");
    assert.equal(state.openResult, "dry-run");
  } finally {
    fs.rmSync(data, { recursive: true, force: true });
  }
});
