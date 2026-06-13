# plugin/ — the Liminal Claude Code plugin (front door)

The install→conversion wedge. Three bounded agents read one brief and disagree;
the in-lane agent works while the others refuse and name the correct agent. Your
correction becomes the record. On enable, a SessionStart hook offers to install
the Liminal desktop app so the vault outlives the session.

## What ships here

- **`.claude-plugin/plugin.json`** + **`.claude-plugin/marketplace.json`** — the
  manifest (so judges can install) with `defaultEnabled: false` (consent gate).
- **`hooks/hooks.json`** + **`bin/liminal-plugin-onboard.js`** — the SessionStart
  installer. Idempotent (state keyed by DMG path+size+mtime), graceful no-op when
  the desktop DMG is absent, macOS `open` only on a real DMG. Override the DMG
  location with `LIMINAL_DMG_PATH`; `LIMINAL_ONBOARD_DRY_RUN=1` skips the open.
- **`commands/try-liminal.md`** + **`skills/try-liminal/`** — `/try-liminal`, the
  60-second taste: one bounded deliberation, disagreement, one captured correction.
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

## Provenance

This is the **public-safe** front door. The richer encrypted vault and the full
12-agent substrate are the private `liminalshruti/liminal-agents` repo (prior art,
PPA-protected). What ships here is a clean reimplementation — see the repo-root
`CONTRIBUTIONS.md` for the built-today vs. prior-art split and exactly which
private pieces were stubbed.
