/**
 * Anthropic client factory (public-safe, zero-dependency).
 *
 * The vendored plugin ships without node_modules, so it cannot assume the
 * @anthropic-ai/sdk is installed. Resolution order:
 *
 *   1. Console API key (the "sk-ant-api" prefix) AND the SDK is importable → SDK client.
 *   2. Otherwise, if the `claude` binary is on PATH → CLI shim. The shim works
 *      with a subscription auth (`claude setup-token`) or an exported key, and
 *      it needs no npm dependency.
 *   3. Nothing → null (caller falls back to the bundled fixture).
 *
 * This factory NEVER logs or persists the key — it hands it straight to the
 * SDK constructor and forgets it.
 */

import { resolveAnthropicKey } from "./auth.js";
import { ClaudeCliClient, claudeCliAvailable } from "./anthropic-cli-shim.js";

export const CLIENT_MODE_API = "api";
export const CLIENT_MODE_CLI = "cli";

async function tryLoadSdk() {
  try {
    const mod = await import("@anthropic-ai/sdk");
    return mod.default || mod.Anthropic || mod;
  } catch {
    return null; // SDK not installed — that's fine, we fall through to the CLI.
  }
}

/**
 * Returns { client, mode }. `client` exposes `.messages.create({...})`.
 * Async because the SDK is loaded lazily and optionally.
 */
export async function makeClient() {
  const key = resolveAnthropicKey();

  if (key && key.startsWith("sk-ant-api")) {
    const Anthropic = await tryLoadSdk();
    if (Anthropic) {
      return { client: new Anthropic({ apiKey: key }), mode: CLIENT_MODE_API };
    }
    // SDK absent but we have an API key — the CLI shim can carry it via the
    // user's `claude` auth / exported env. Fall through.
  }

  if (claudeCliAvailable()) {
    return { client: new ClaudeCliClient(), mode: CLIENT_MODE_CLI };
  }

  return { client: null, mode: null };
}
