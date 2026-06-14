# plugin/ — the Liminal Claude Code plugin (front door)

The install→conversion wedge. Three bounded agents read one brief and disagree;
the in-lane agent works while the others refuse and name the correct agent. Your
correction becomes the record. On enable, a SessionStart hook offers to install
the Liminal desktop app so the vault outlives the session.

## What ships here

- **`.claude-plugin/plugin.json`** + **`.claude-plugin/marketplace.json`** — the
  manifest (so judges can install) with `defaultEnabled: false` (consent gate).
- **`hooks/hooks.json`** + **`bin/liminal-plugin-onboard.js`** — the SessionStart
  installer with two install lanes: open the desktop DMG when present, and always
  offer the **live web cockpit** so onboarding never dead-ends. Idempotent (state
  keyed by DMG path+size+mtime), graceful no-op when neither lane is ready, macOS
  `open` only on a real DMG. Override the DMG location with `LIMINAL_DMG_PATH`;
  `LIMINAL_ONBOARD_DRY_RUN=1` skips the open. The cockpit URL is configurable via
  **`LIMINAL_COCKPIT_URL`** (see *Configuration* below).
- **`commands/try-liminal.md`** + **`skills/try-liminal/`** — `/try-liminal`, the
  60-second taste: one bounded deliberation, disagreement, one captured correction.
- **`commands/onboard-swarm.md`** + **`skills/onboard-swarm/`** + **`lib/onboard/swarm.js`**
  — `/onboard-swarm`, the parallel per-agent context scan that beats cold-start.
  Each bounded agent scans its canonical stream in parallel (git/claude-code →
  Analyst, granola/calendar → SDR, cross-stream → Auditor) and reports the
  candidate streams it can pull from — read-only, LLM-free filesystem/git probes,
  no ingest. Proves the vault won't start empty.
- **`agents/liminal-{analyst,auditor,sdr}.md`** — bounded subagents, `model: opus`,
  tight `tools:` allowlist, strict REFUSE protocol.
- **`lib/`** — a **public-safe** local substrate: a plain (non-encrypted) SQLite
  "taste vault" on Node's built-in `node:sqlite`, the bounded-agent composer +
  refusal classifier, and a zero-dependency Anthropic client (SDK if installed,
  else the `claude` CLI shim). No SQLCipher, no Keychain, no private internals.
- **`test/plugin-integration.test.js`** — the offline integration suite.

## Run it

```bash
# Validate the plugin + marketplace
claude plugin validate ./plugin --strict

# Tests (offline; uses the bundled fixture)
node --test plugin/test/*.test.js

# Live taste on Opus (needs an Anthropic API key, or `claude setup-token`)
export ANTHROPIC_API_KEY=<your-anthropic-api-key>
node plugin/skills/try-liminal/run.js
```

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| **`LIMINAL_COCKPIT_URL`** | `https://liminal-govern-cockpit.vercel.app` *(the live cockpit — this is the built-in default `DEFAULT_COCKPIT_URL` in `bin/liminal-plugin-onboard.js`; no need to set it)* | The web-cockpit install lane the SessionStart hook offers. Defaults to the live, demo-coherent govern cockpit (not the old liminal-space `/pilot` page, which is a different product). Override only to point at a different deployment; set to `""` or `none` to disable the web lane entirely. |
| `LIMINAL_DMG_PATH` | unset | Point the installer at a specific desktop DMG (otherwise it scans the desktop build's bundle dir). |
| `LIMINAL_ONBOARD_DRY_RUN` | unset | `1` skips the macOS `open` (used by tests/CI). |
| `LIMINAL_GIT_REPO` / `LIMINAL_GRANOLA_PATH` | working dir / default cache | Point `/onboard-swarm` source probes at specific locations. |

> **Deploy note:** the govern cockpit is **live** at
> `https://liminal-govern-cockpit.vercel.app`, and that is the built-in default
> (`DEFAULT_COCKPIT_URL` in `bin/liminal-plugin-onboard.js`) — onboarding opens the
> correct, demo-coherent cockpit with **no env var set**. Override `LIMINAL_COCKPIT_URL`
> only to point at a different deployment.

## Provenance

This is the **public-safe** front door. The richer encrypted vault and the full
12-agent substrate are the private `liminalshruti/liminal-agents` repo (prior art,
PPA-protected). What ships here is a clean reimplementation — see the repo-root
`CONTRIBUTIONS.md` for the built-today vs. prior-art split and exactly which
private pieces were stubbed.
