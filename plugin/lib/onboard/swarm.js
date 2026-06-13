/**
 * Onboarding swarm — the lightweight, parallel, per-agent context scan that
 * runs BEFORE the first deliberation. This is the "beats cold-start" beat: when
 * Liminal is first installed, instead of an empty vault and a blank prompt, the
 * bounded agents each scan their canonical context stream in parallel and report
 * what they can pull from. The user sees real candidate streams, owned by the
 * agent whose lane they belong to, in the first second.
 *
 * This is the shipped, lightweight version. It is deliberately:
 *   - LLM-free. Each scan is a cheap filesystem / git probe, not an Opus call.
 *     That sidesteps the deferred concern (three agents
 *     scanning in parallel would otherwise triple cold-start token cost) while
 *     still proving the swarm geometry end to end.
 *   - Read-only. It detects candidate streams; it does NOT ingest. Ingest is the
 *     daemon's job (lib/sources/*). The swarm answers "what's here?" so the
 *     first deliberation isn't cold.
 *   - Partial-result safe. Probes run under Promise.allSettled — the same
 *     contract runAllAgents (lib/agents/index.js) uses — so one source failing
 *     (e.g. Granola not installed) never loses the others.
 *
 * Wire type:
 *   OnboardingStream { source, agent_owner, status, detail, count }
 *   status: "scanning"  — a candidate stream was found and is ready to ingest
 *           "pending"   — the source isn't present yet (nothing to scan)
 *
 * The bounded geometry (which agent owns which stream) is the shipped geometry:
 *   git / claude-code  → Analyst (facts: what was built, what changed)
 *   granola / calendar → SDR     (commitments: who, when, the next move)
 *   cross-stream       → Auditor (risks: gaps, drift across the other streams)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pExec = promisify(execFile);

// ── Stream registry — each entry is one parallel probe ─────────────────────
// owner is the bounded agent whose lane the stream belongs to. probe() returns
// { status, detail, count }. Probes never throw out — they resolve to a
// "pending" result on any error so the swarm stays partial-result safe even
// without relying on allSettled's rejection path.

const STREAMS = [
  { source: "git", owner: "Analyst", probe: probeGit },
  { source: "claude-code", owner: "Analyst", probe: probeClaudeCode },
  { source: "granola", owner: "SDR", probe: probeGranola },
  { source: "calendar", owner: "SDR", probe: probeCalendar },
];

function pending(detail) {
  return { status: "pending", detail, count: 0 };
}
function scanning(count, detail) {
  return { status: "scanning", count, detail };
}

// git → Analyst. A candidate stream if the working dir (or LIMINAL_GIT_REPO) is
// a git repo with commits in the recent window. Cheap: one `git log` count.
async function probeGit() {
  const repo = process.env.LIMINAL_GIT_REPO || process.cwd();
  try {
    if (!fs.existsSync(path.join(repo, ".git"))) {
      return pending("no git repo at working dir");
    }
    const { stdout } = await pExec(
      "git",
      ["-C", repo, "log", "--since=30.days.ago", "--oneline"],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    const count = stdout.split("\n").filter(Boolean).length;
    if (count === 0) return pending("git repo present, no commits in 30d");
    return scanning(count, `${count} commit(s) in last 30d at ${path.basename(repo)}`);
  } catch {
    return pending("git probe failed");
  }
}

// claude-code → Analyst. Candidate if ~/.claude/projects holds recent session
// transcripts. Counts .jsonl files touched in the recent window.
async function probeClaudeCode() {
  const dir = path.join(os.homedir(), ".claude", "projects");
  try {
    if (!fs.existsSync(dir)) return pending("no ~/.claude/projects");
    const cutoff = recentCutoff();
    let count = 0;
    for (const proj of safeReaddir(dir)) {
      const projDir = path.join(dir, proj);
      for (const f of safeReaddir(projDir)) {
        if (!f.endsWith(".jsonl")) continue;
        try {
          if (fs.statSync(path.join(projDir, f)).mtimeMs >= cutoff) count++;
        } catch {
          /* skip unreadable */
        }
      }
    }
    if (count === 0) return pending("no recent Claude Code sessions");
    return scanning(count, `${count} recent Claude Code session file(s)`);
  } catch {
    return pending("claude-code probe failed");
  }
}

// granola → SDR. Candidate if the Granola cache exists and parses to documents.
async function probeGranola() {
  const cache =
    process.env.LIMINAL_GRANOLA_PATH ||
    path.join(os.homedir(), "Library", "Application Support", "Granola", "cache-v6.json");
  try {
    if (!fs.existsSync(cache)) return pending("Granola not installed");
    const parsed = JSON.parse(fs.readFileSync(cache, "utf8"));
    const docs = parsed?.cache?.state?.documents;
    const count = docs && typeof docs === "object" ? Object.keys(docs).length : 0;
    if (count === 0) return pending("Granola cache empty");
    return scanning(count, `${count} meeting note(s) in Granola`);
  } catch {
    return pending("Granola cache unreadable");
  }
}

// calendar → SDR. No adapter ships yet (see "next"), so this
// is always pending — it holds the slot in the swarm so the geometry is honest
// about what's coming rather than hiding it.
async function probeCalendar() {
  return pending("calendar adapter not yet wired (next)");
}

function recentCutoff() {
  // 14 days, in ms, derived from a passed-in clock when available so the module
  // stays testable. Date.now() is fine here (runtime path), but allow override.
  const days = 14;
  const nowMs = Number(process.env.LIMINAL_SWARM_NOW_MS) || Date.now();
  return nowMs - days * 24 * 60 * 60 * 1000;
}

function safeReaddir(p) {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

/**
 * Run all source probes in parallel and derive the Auditor's cross-stream view.
 * Returns { streams: OnboardingStream[], summary }.
 */
export async function scanStreams() {
  const settled = await Promise.allSettled(
    STREAMS.map(async (s) => {
      const r = await s.probe();
      return { source: s.source, agent_owner: s.owner, ...r };
    }),
  );

  const streams = settled.map((res, i) => {
    if (res.status === "fulfilled") return res.value;
    // Probe rejected outright — record it as pending rather than dropping it,
    // so the swarm output always covers every declared stream.
    const def = STREAMS[i];
    return {
      source: def.source,
      agent_owner: def.owner,
      status: "pending",
      detail: `probe error: ${res.reason?.message || "unknown"}`,
      count: 0,
    };
  });

  // Auditor → cross-stream risk view. The Auditor doesn't own a raw source; it
  // owns the seams between them. It becomes a live candidate once at least two
  // other streams have signal (there's something to cross-check); otherwise it
  // waits, like its bounded counterpart waits for finished work to judge.
  const live = streams.filter((s) => s.status === "scanning");
  const auditor =
    live.length >= 2
      ? {
          source: "cross-stream",
          agent_owner: "Auditor",
          status: "scanning",
          detail: `${live.length} streams to cross-check for gaps and drift`,
          count: live.length,
        }
      : {
          source: "cross-stream",
          agent_owner: "Auditor",
          status: "pending",
          detail: "needs ≥2 live streams before there's drift to audit",
          count: 0,
        };
  streams.push(auditor);

  const liveCount = streams.filter((s) => s.status === "scanning").length;
  return {
    streams,
    summary: {
      streams_total: streams.length,
      streams_live: liveCount,
      cold_start: liveCount === 0,
    },
  };
}
