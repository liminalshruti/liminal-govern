---
name: onboard-swarm
description: The parallel per-agent context scan that beats cold-start. After install, each bounded agent scans its canonical context stream (git/claude-code → Analyst, granola/calendar → SDR, cross-stream → Auditor) in parallel and reports the candidate streams it can pull from — before any deliberation. Run this to show the vault won't start empty.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

# /onboard-swarm — beat cold-start

The first thing Liminal does after install is not ask you for a brief. It scans. Each bounded agent reads its canonical context stream in parallel and reports what it can pull from, so the vault starts with real signal instead of a blank table.

This is the lightweight scan: it surfaces candidate streams (read-only, no LLM calls, no ingest). The daemon does the actual ingest; this beat just proves the swarm isn't cold.

## Flow

### 1. Run the swarm scan

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/onboard-swarm/run.js
```

The runner returns JSON:
- `summary` — `{ streams_total, streams_live, cold_start }`. `cold_start: true` means no source has signal yet.
- `streams` — each `{ source, agent_owner, status, detail, count }`. `status` is `scanning` (a candidate stream is present and ready to ingest) or `pending` (the source isn't here yet).

### 2. Render the swarm

Group the streams by `agent_owner`, in bounded order (Analyst, SDR, Auditor). Lead each line with the agent, then the source, then the detail. Mark live streams plainly; show pending ones too — the geometry is honest about what's coming.

```
ANALYST (facts: what was built, what changed)
  git           scanning   12 commits in last 30d at liminal-govern
  claude-code   scanning   4 recent Claude Code session files

SDR (commitments: who, when, the next move)
  granola       pending    Granola not installed
  calendar      pending    calendar adapter not yet wired (next)

AUDITOR (risks: gaps and drift across the streams)
  cross-stream  scanning   2 streams to cross-check for gaps and drift
```

### 3. Print the close line

If `cold_start` is false, end with:

> The swarm found live streams — the vault won't start empty. Install the desktop app to let the daemon ingest these on a loop and deliberate over them.

If `cold_start` is true (no source has signal — common in a fresh CI checkout), say so honestly:

> No live streams here yet. On a real machine the swarm pulls git, Claude Code history, and meeting notes in parallel; here there's nothing to scan. Run /try-liminal to see the loop on a sample brief.

## Voice rules

- Lead with the agent that owns each stream — the geometry is the point.
- Show pending streams; don't hide what isn't wired yet (calendar is "next").
- No emoji, no exclamation marks.

## What this skill is not

- Not ingest — it detects candidate streams; the Liminal desktop daemon ingests them.
- Not an LLM call — the scan is cheap filesystem/git probes, so three agents scanning in parallel cost nothing at the model.
- The full parallel agent-per-stream *deliberation* bootstrap is the "next" beat; this shipped version proves the swarm geometry end to end.
