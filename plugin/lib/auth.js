/**
 * Anthropic credential resolver.
 *
 * The Anthropic Node SDK only accepts API keys (x-api-key header), not OAuth
 * bearer tokens. Claude Code does not export its Keychain credentials to
 * subprocesses, so strict OAuth-session inheritance is not available.
 *
 * The closest practical alternative: read whichever credential env var the
 * user's Claude session has populated. This resolver checks, in order:
 *
 *   1. ANTHROPIC_API_KEY                      — explicit, what the SDK expects
 *   2. CLAUDE_PLUGIN_OPTION_ANTHROPIC_API_KEY — plugin-option pass-through
 *   3. CLAUDE_CODE_OAUTH_TOKEN                — `claude setup-token` output
 *   4. ANTHROPIC_AUTH_TOKEN                   — alt alias some setups use
 *
 * Recommended user flow: run `claude setup-token` once. That stores a
 * long-lived token tied to the user's Claude subscription and the surface
 * inherits it without further configuration.
 *
 * PUBLIC-SAFE: reads env vars only. It never logs, persists, or echoes a key.
 */

const KEY_VARS = [
  "ANTHROPIC_API_KEY",
  "CLAUDE_PLUGIN_OPTION_ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_AUTH_TOKEN",
];

export function resolveAnthropicKey() {
  for (const name of KEY_VARS) {
    const v = process.env[name];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
