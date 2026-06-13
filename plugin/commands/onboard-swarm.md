---
description: The parallel per-agent context scan that beats cold-start — each bounded agent scans its canonical context stream (git/claude-code → Analyst, granola/calendar → SDR, cross-stream → Auditor) in parallel and reports the candidate streams it can pull from, before any deliberation.
---

Invoke the `onboard-swarm` skill and follow its SKILL.md flow exactly: run the swarm scan, render the candidate streams grouped by the bounded agent that owns each (Analyst / SDR / Auditor), then print the close line — honest about cold-start when no source has signal.
