# plugin/ — Stream S2: the Claude Code plugin (front door)

The install→conversion wedge. `liminal setup` connects existing context and sets up the desktop app.

**Build:**
- `.claude-plugin/plugin.json` (manifest) + `.claude-plugin/marketplace.json` (so judges can install).
- `hooks/` — **SessionStart** hook that (a) walks the user through downloading/opening the desktop DMG,
  (b) detects existing Claude Code / MCP setup, (c) runs the **onboarding swarm** to suggest context
  streams. Idempotent; `defaultEnabled:false` for consent.
- `skills/` — `liminal setup` + a `try-liminal` taste skill.
- `agents/*.md` — bounded spend-governance agents (`model: opus`, tight `tools:` allowlist).

Public MIT base = `liminalshruti/liminal-agents` (vendor/adapt, note in-file). Validate with
`claude plugin validate . --strict`. Full spec: private founder-brain `ops/build-day/streams/S2_PLUGIN_FRONT_DOOR.md`.
