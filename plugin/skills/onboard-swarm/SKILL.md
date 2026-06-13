---
name: onboard-swarm
description: The parallel per-agent swarm that beats cold-start. After install, each bounded agent reads its canonical source (git/claude-code → Analyst, granola → SDR, cross-stream → Auditor) in parallel and posts a candidate — the one fact, commitment, or risk worth acting on — before any deliberation. Read-only, LLM-optional. Run this to show the vault won't start empty.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

# /onboard-swarm — beat cold-start

The first thing Liminal does after install is not ask you for a brief. It reads. Each bounded agent reads its canonical source in parallel and posts a candidate — the one fact, commitment, or risk worth acting on — so the first deliberation starts warm instead of from a blank table.

This is the full deliberation bootstrap. It is read-only (it reads sources and posts candidates in memory; it does not write the vault or mutate any source — the daemon does the real ingest) and LLM-optional (each agent deliberates live on Opus when a credential is present; otherwise it falls back to a labeled fixture so the beat always renders).

## Flow

### 1. Run the swarm

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/onboard-swarm/run.js
```

The runner returns JSON:
- `mode` — `live` if the agents read on Opus, `fixture` if no Anthropic credential was available (say so honestly), `cold` if no source has signal.
- `summary` — `{ streams_total, streams_live, candidates_total, cold_start }`.
- `candidates` — each `{ source, agent_owner, status, interpretation, refused, mode }`. The owning agent reads its own source, so candidates are in-lane work, not refusals.

For the lightweight "what's here?" probe (no agent reads, no LLM), pass `--scan` — it returns `{ summary, streams }` where each stream is `{ source, agent_owner, status, detail, count }`.

### 2. Render the swarm

Group candidates by `agent_owner`, in bounded order (Analyst, SDR, Auditor). Lead each block with the agent and the source it read, then its candidate.

```
ANALYST (facts: what was built, what changed)
  from git          [the candidate fact]
  from claude-code  [the candidate fact]

SDR (commitments: who, when, the next move)
  from granola      [the candidate commitment]

AUDITOR (risks: gaps and drift across the streams)
  from cross-stream [the candidate risk — reads the other agents' candidates]
```

If `mode` is `fixture`, add one plain line: "(candidates shown from a bundled sample — set ANTHROPIC_API_KEY or run `claude setup-token` to run this live on Opus.)"

### 3. Print the close line

If candidates were posted, end with:

> The swarm read your streams and posted candidates — the first deliberation won't start cold. Install the desktop app to let the daemon ingest these on a loop and deliberate over them.

If `mode` is `cold` (no source has signal — common in a fresh CI checkout), say so honestly:

> No live streams here yet. On a real machine the swarm reads git, Claude Code history, and meeting notes in parallel; here there's nothing to read. Run /try-liminal to see the loop on a sample brief.

## Voice rules

- Lead with the agent that owns each stream — the bounded geometry is the point.
- Candidates are in-lane work; the refusal beat lives in /try-liminal, not here.
- No emoji, no exclamation marks.

## What this skill is not

- Not ingest — it posts candidates in memory; the daemon (`bin/liminal-substrated.js`) persists ingested signal.
- Not a vault write — read-only by design, so a first run never touches the real vault.
- Calendar has no adapter yet (the remaining "next" in `docs/specs/2026-06-13-swarm-onboarding.md`), so it never posts a candidate.
