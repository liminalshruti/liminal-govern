# liminal-govern MCP server

An [MCP](https://modelcontextprotocol.io) server (stdio) that exposes the liminal-govern
**spend-governance engine** + **provenance chain** as tools — so **any** Claude session can run a
spend audit and query provenance without reimplementing either. Additive: it wraps the existing
`engine/` and `provenance/` packages; it does not modify them.

## What it exposes

### Tools

| Tool | Args | Returns |
| --- | --- | --- |
| `run_spend_audit` | `{ fixture? }` | The governance result. Default (`usage-events`) returns the **canonical** report: total recommended savings **$284**, the claim **dropped by adversarial review (E14)**, and the **ratified decision**. A seat-utilization fixture (`q2-spend`, `sample-spend`, or a path to a spend CSV) runs the **live engine** and reconciles the per-finding savings against the headline total. |
| `verify_chain` | `{}` | Walks the provenance chain (re-anchored in-memory from the report's findings + ratified decision) and returns a **per-link integrity report** — each link's hash, prev-hash link, ok/break — plus the overall verdict. A real cryptographic walk, not a stored boolean. |
| `get_finding` | `{ id }` | A finding (e.g. `F-E12`, `F-E14`, `F-OKR-SECURITY`) + its **anchor receipt** + its **correction trail**. A finding dropped by adversarial review (`F-E14`) has no receipt and carries its drop reason. |
| `corrections_of` | `{ id }` | The **correction/refutation trail** for a finding. For `F-E14`: the PR-103 refutation that dropped the $162 claim. |

### Resource

| URI | Content |
| --- | --- |
| `governance://report.json` | The immutable seeded governance report (`out/report.json`) — classified usage, findings, dropped claims, the ratified decision, the provenance summary, and the **source-row citations** a caller can cite. |

## Two layers, both real

- **Canonical** — `out/report.json` is the committed result of governing `data/usage-events.csv`
  (the 8-agent deliberation + adversarial review + provenance anchoring). `run_spend_audit` with no
  fixture returns it; `verify_chain` re-anchors its findings into a real hash-linked chain and walks
  it; `get_finding`/`corrections_of` read its receipts and the E14 drop trail.
- **Live engine** — `run_spend_audit({ fixture: "q2-spend" })` calls the engine's deterministic
  `analyze()` over a spend fixture and reconciles the total live. Rerunnable on fresh data —
  point it at any spend CSV.

## Install

```bash
# from the repo root — build the provenance lib (the engine + this server import its dist):
npm --prefix provenance install && npm --prefix provenance run build

# install this server's deps:
npm --prefix mcp install
```

No API key and no network are required for any of the four tools (the on-chain anchor is env-gated
and skipped by default).

## Register it with Claude

### Option A — `claude mcp add` (recommended)

```bash
claude mcp add liminal-govern -- node --import tsx /ABSOLUTE/PATH/TO/lg-mcp/mcp/src/server.ts
```

### Option B — `.mcp.json`

Copy [`.mcp.json`](./.mcp.json) into your project (or merge the `mcpServers` block), replacing the
path with the absolute path to `mcp/src/server.ts`:

```json
{
  "mcpServers": {
    "liminal-govern": {
      "command": "node",
      "args": ["--import", "tsx", "/ABSOLUTE/PATH/TO/lg-mcp/mcp/src/server.ts"]
    }
  }
}
```

Then, in any Claude session: *"run a spend audit"*, *"verify the provenance chain"*, *"show me
finding F-E14 and why it was dropped"*.

### Shipping it from the Liminal plugin (wired)

The Liminal plugin ships this server on install. `plugin/.claude-plugin/plugin.json` declares
`"mcpServers": "./.mcp.json"`, and [`plugin/.mcp.json`](../plugin/.mcp.json) launches it:

```json
{
  "mcpServers": {
    "liminal-govern": {
      "command": "bash",
      "args": ["-c", "cd \"${CLAUDE_PLUGIN_ROOT}/../mcp\" && … && exec node_modules/.bin/tsx src/server.ts"]
    }
  }
}
```

So enabling the plugin registers the four governance tools automatically. Details:

- `${CLAUDE_PLUGIN_ROOT}` resolves to the installed `plugin/` dir; `../mcp` is its sibling in the
  same repo/clone (this server lives in the top-level `mcp/`, not under `plugin/`).
- The launcher is **self-bootstrapping**: on first run it `npm install`s this server's deps and
  builds `provenance/dist` if missing, then `exec`s the server. Subsequent runs skip straight to
  boot. (A `bash -c "cd … && exec …"` wrapper is used because the MCP `cwd` field is currently a
  no-op in Claude Code.)
- Caveat: a plugin installed from a **marketplace subpath** may copy only the `plugin/` subdir, in
  which case the sibling `mcp/` is absent — install from the full repo (or `--plugin-dir`) for the
  bundled server. Standalone use (Option A/B above) always works.

## Test

```bash
npm --prefix mcp test     # boots the server over stdio, calls run_spend_audit ($284), verify_chain, live audit
```

## Follow-on

A **Managed-Agents** wrapper for scheduled audits (long-running, server-side spend audits on a
cron) is the scale path noted in the brief — this stdio server is the local-first slice.
