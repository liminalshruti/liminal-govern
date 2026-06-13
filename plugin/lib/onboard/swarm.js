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
 *     That sidesteps the deferred concern from the design doc (three agents
 *     scanning in parallel would otherwise triple cold-start token cost) while
 *     still proving the swarm geometry end to end.
 *   - Read-only. It detects candidate streams; it does NOT ingest. Ingest is the
 *     daemon's job (lib/sources/*). The swarm answers "what's here?" so the
 *     first deliberation isn't cold.
 *   - Partial-result safe. Probes run under Promise.allSettled — the same
 *     contract runAllAgents (lib/agents/index.js) uses — so one source failing
 *     (e.g. Granola not installed) never loses the others.
 *
 * Wire type (mirrors docs/specs/2026-06-13-swarm-onboarding.md):
 *   OnboardingStream { source, agent_owner, status, detail, count }
 *   status: "scanning"  — a candidate stream was found and is ready to ingest
 *           "pending"   — the source isn't present yet (nothing to scan)
 *
 * The bounded geometry (which agent owns which stream) matches the design doc:
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

// Agent set + runner are imported lazily inside bootstrapSwarm() so the cheap
// scanStreams() path (and its tests) never pay the cost of loading the agent
// graph or the Anthropic SDK. See bootstrapSwarm() below.

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

// calendar → SDR. No adapter ships yet (see "next" in the design doc), so this
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

// ───────────────────────────────────────────────────────────────────────────
//  Full swarm — parallel per-agent deliberation bootstrap
// ───────────────────────────────────────────────────────────────────────────
//
// The lightweight scanStreams() above answers "what's here?". The bootstrap is
// the deferred "next" from the design doc, now built: each bounded agent READS
// its canonical source and POSTS A CANDIDATE — the one fact / commitment / risk
// worth acting on — all in parallel under Promise.allSettled. This is what makes
// the first deliberation warm: the vault opens with agent-authored candidates,
// not an empty table.
//
// It stays inside the front-door invariants:
//   - READ-ONLY. It reads source content (git log, Claude Code transcripts,
//     Granola cache) and returns candidates in memory. It does NOT write the
//     vault and does NOT mutate any source. Persisting candidates is the
//     daemon's job; the bootstrap proves the swarm geometry without committing.
//   - LLM-OPTIONAL. With an Anthropic credential each agent deliberates live on
//     Opus; without one (or with LIMINAL_SWARM_FIXTURE=1) it falls back to a
//     labeled per-agent fixture so the beat always renders. Honest about which.
//   - PARTIAL-RESULT SAFE. Per-agent reads run under Promise.allSettled — one
//     agent failing never loses the others' candidates.

const DIGEST_MAX_ITEMS = 12;
const DIGEST_MAX_CHARS = 1800;

// ── Read-only source digests — short text samples the owning agent reads ────

async function digestGit() {
  const repo = process.env.LIMINAL_GIT_REPO || process.cwd();
  if (!fs.existsSync(path.join(repo, ".git"))) return "";
  try {
    const { stdout } = await pExec(
      "git",
      ["-C", repo, "log", "--since=30.days.ago", `-n${DIGEST_MAX_ITEMS}`, "--format=%s"],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    return clampDigest(
      stdout
        .split("\n")
        .filter(Boolean)
        .map((s) => `- ${s}`)
        .join("\n"),
    );
  } catch {
    return "";
  }
}

function digestClaudeCode() {
  const dir = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(dir)) return "";
  const cutoff = recentCutoff();
  const items = [];
  for (const proj of safeReaddir(dir)) {
    const projDir = path.join(dir, proj);
    for (const f of safeReaddir(projDir)) {
      if (!f.endsWith(".jsonl")) continue;
      const full = path.join(projDir, f);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.mtimeMs < cutoff) continue;
      const text = firstUserText(full);
      if (text) items.push(`- ${oneLine(text)}`);
      if (items.length >= DIGEST_MAX_ITEMS) break;
    }
    if (items.length >= DIGEST_MAX_ITEMS) break;
  }
  return clampDigest(items.join("\n"));
}

function digestGranola() {
  const cache =
    process.env.LIMINAL_GRANOLA_PATH ||
    path.join(os.homedir(), "Library", "Application Support", "Granola", "cache-v6.json");
  if (!fs.existsSync(cache)) return "";
  let docs;
  try {
    docs = JSON.parse(fs.readFileSync(cache, "utf8"))?.cache?.state?.documents;
  } catch {
    return "";
  }
  if (!docs || typeof docs !== "object") return "";
  const items = [];
  for (const id of Object.keys(docs)) {
    const d = docs[id];
    if (!d || typeof d !== "object" || d.deleted_at) continue;
    const title = (d.title || "").trim();
    const summary = (d.summary || d.overview || d.notes_plain || "").trim();
    if (!title && !summary) continue;
    items.push(`- ${oneLine([title, summary].filter(Boolean).join(": "))}`);
    if (items.length >= DIGEST_MAX_ITEMS) break;
  }
  return clampDigest(items.join("\n"));
}

// Read just the first user message text out of a JSONL transcript, cheaply.
function firstUserText(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  for (const line of raw.split("\n")) {
    if (!line) continue;
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    const role = evt.role || evt.message?.role || evt.type;
    if (role !== "user" && role !== "user_message") continue;
    const src = evt.message ?? evt;
    if (typeof src.content === "string") return src.content;
    if (Array.isArray(src.content)) {
      const t = src.content.filter((b) => b.type === "text").map((b) => b.text).join(" ");
      if (t) return t;
    }
  }
  return null;
}

function oneLine(s) {
  return String(s).replace(/\s+/g, " ").trim().slice(0, 160);
}
function clampDigest(s) {
  return s.slice(0, DIGEST_MAX_CHARS);
}

// Source → read-only digest reader. Calendar has no adapter (the "next"), so it
// has no digest and never produces a candidate.
const DIGESTS = {
  git: digestGit,
  "claude-code": digestClaudeCode,
  granola: digestGranola,
};

// ── Per-agent candidate prompts ─────────────────────────────────────────────
// Each owning agent reads its source digest in lane and posts ONE candidate.
// Because the stream is assigned to the agent that owns it, the in-lane agent
// does the work (it does not refuse) — the bootstrap surfaces candidates, the
// refusal beat lives in /try-liminal.

function candidateBrief(agentName, source, digest) {
  const lane = {
    Analyst: "the one fact worth acting on — what was built or what changed that matters",
    SDR: "the one commitment worth acting on — who, by when, the next move",
    Auditor: "the one risk worth flagging — a gap, a stale commitment, or drift across the streams",
  }[agentName];
  return (
    `Onboarding scan of the user's ${source} stream. Recent activity:\n${digest}\n\n` +
    `As the ${agentName}, surface ${lane}. ` +
    `One short paragraph — a candidate to seed the first deliberation, not a full report.`
  );
}

// Cross-stream brief for the Auditor: the union of the other agents' candidates.
function auditorBrief(candidates) {
  const body = candidates
    .map((c) => `${c.agent_owner} (${c.source}): ${oneLine(c.interpretation)}`)
    .join("\n");
  return (
    `Onboarding scan across the user's streams. Candidates the other agents posted:\n${body}\n\n` +
    `As the Auditor, surface the one risk worth flagging — a gap, a stale commitment, ` +
    `or drift between these candidates. One short paragraph.`
  );
}

// Labeled fixtures so the bootstrap renders without a credential. Kept generic
// (no invented specifics) so we never imply a live read that didn't happen.
const FIXTURE_CANDIDATE = {
  Analyst:
    "Recent activity centers on shipping and hardening one workstream. The candidate worth acting on is the most-touched area — treat its momentum as the spine of the next deliberation and confirm nothing downstream of it has gone stale.",
  SDR:
    "The candidate commitment is the most recent external thread that named a person and a time. The next move is to confirm whether that commitment was met or is now overdue before anything else gets queued.",
  Auditor:
    "The risk worth flagging is the seam between the streams: work is moving in one lane while commitments in another may not have been closed. Cross-check the open commitments against what actually shipped before acting.",
};

function detectRefusal(text) {
  return /^\s*REFUSE\s*:/.test(text || "");
}

/**
 * Run the full onboarding swarm: each bounded agent reads its live source and
 * posts a candidate, in parallel. Read-only, LLM-optional.
 *
 * @param {object?} opts
 * @param {boolean} opts.forceFixture  Force the fixture path (tests/offline).
 * @returns {Promise<{ mode, candidates, summary }>}
 *   candidates: [{ source, agent_owner, status:"ingested", interpretation,
 *                  refused, mode }]
 */
export async function bootstrapSwarm(opts = {}) {
  const { streams, summary } = await scanStreams();

  // Live source streams (exclude the derived cross-stream entry) get a reader.
  const liveSources = streams.filter(
    (s) => s.status === "scanning" && s.source !== "cross-stream" && DIGESTS[s.source],
  );

  if (liveSources.length === 0) {
    return {
      mode: "cold",
      candidates: [],
      summary: { ...summary, candidates_total: 0, cold_start: true },
    };
  }

  // Decide the inference mode once: live (Opus) if a credential exists and the
  // caller didn't force fixture; otherwise the labeled fixture.
  let client = null;
  let runAgent = null;
  let AGENT_BY_NAME = {};
  let model;
  const forceFixture =
    opts.forceFixture || process.env.LIMINAL_SWARM_FIXTURE === "1";

  if (!forceFixture) {
    try {
      const [{ makeClient }, agentsMod] = await Promise.all([
        import("../anthropic-client.js"),
        import("../agents/index.js"),
      ]);
      client = makeClient().client;
      runAgent = agentsMod.runAgent;
      model = agentsMod.OPUS_MODEL;
      AGENT_BY_NAME = Object.fromEntries(
        agentsMod.AGENCY_AGENTS.map((a) => [a.name, a]),
      );
    } catch {
      client = null; // fall through to fixture
    }
  }

  const live = Boolean(client && runAgent);

  // Build a candidate from one (agent, source, digest) — live or fixture.
  async function postCandidate(agentName, source, digest) {
    const base = { source, agent_owner: agentName, status: "ingested" };
    if (live) {
      const agent = AGENT_BY_NAME[agentName];
      const brief =
        source === "cross-stream"
          ? digest // already a composed brief
          : candidateBrief(agentName, source, digest);
      const res = await runAgent(client, agent, brief, null, model);
      const text = res.interpretation || "";
      return { ...base, interpretation: text, refused: detectRefusal(text), mode: "live" };
    }
    return {
      ...base,
      interpretation: FIXTURE_CANDIDATE[agentName],
      refused: false,
      mode: "fixture",
    };
  }

  // Phase 1: every live source read in parallel by its owning agent.
  const settled = await Promise.allSettled(
    liveSources.map(async (s) => {
      const digest = await DIGESTS[s.source]();
      if (!digest) throw new Error(`empty digest for ${s.source}`);
      return postCandidate(s.agent_owner, s.source, digest);
    }),
  );
  const candidates = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  // Phase 2: the Auditor reads the union of the posted candidates and adds the
  // cross-stream risk candidate — but only when there are ≥2 to cross-check
  // (the same threshold scanStreams uses for the Auditor's seam).
  if (candidates.length >= 2) {
    try {
      const auditCand = live
        ? await postCandidate("Auditor", "cross-stream", auditorBrief(candidates))
        : {
            source: "cross-stream",
            agent_owner: "Auditor",
            status: "ingested",
            interpretation: FIXTURE_CANDIDATE.Auditor,
            refused: false,
            mode: "fixture",
          };
      candidates.push(auditCand);
    } catch {
      // Auditor failing is non-fatal — keep the source candidates.
    }
  }

  return {
    mode: live ? "live" : "fixture",
    candidates,
    summary: {
      ...summary,
      candidates_total: candidates.length,
      cold_start: candidates.length === 0,
    },
  };
}
