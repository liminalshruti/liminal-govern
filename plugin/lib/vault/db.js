/**
 * Public-safe "taste vault" — a PLAIN (non-encrypted) local SQLite store.
 *
 * PUBLIC-SAFE REIMPLEMENTATION. The private liminal-agents vault is a SQLCipher
 * (better-sqlite3-multiple-ciphers) database fronted by a Keychain-backed
 * keyguard (lib/vault/{crypto,keyguard,secure-erase}.js). NONE of that ships
 * here. This module is a clean, dependency-free rewrite on Node's built-in
 * `node:sqlite`:
 *
 *   - NO encryption, NO Keychain, NO key material. It is explicitly a
 *     throwaway taste vault — the /try-liminal SKILL says so out loud and never
 *     claims encryption-at-rest.
 *   - The schema is the minimal subset the front-door loop needs:
 *     signal_events, deliberations, agent_views, corrections.
 *   - The db lives at <vaultDir>/vault.db where vaultDir defaults to a temp
 *     dir set by the runner. The correction-stream record — not the crypto —
 *     is the point of the taste.
 *
 * The richer encrypted vault (and the full 9-table schema) is the desktop app,
 * offered by the SessionStart hook on enable.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function vaultDir() {
  if (process.env.LIMINAL_VAULT_DIR) return process.env.LIMINAL_VAULT_DIR;
  // Stable per-user fallback (still plain, still a taste vault).
  return path.join(os.homedir(), ".liminal", "taste-vault");
}

export function vaultDbPath() {
  return path.join(vaultDir(), "vault.db");
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS signal_events (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    source TEXT NOT NULL,
    kind TEXT NOT NULL,
    register TEXT NOT NULL,
    thread_id TEXT,
    content TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    vault_origin TEXT NOT NULL DEFAULT 'native'
  );
  CREATE TABLE IF NOT EXISTS deliberations (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    trigger TEXT NOT NULL,
    signal_ids TEXT,
    user_state TEXT,
    user_context TEXT,
    architect_view TEXT,
    witness_view TEXT,
    contrarian_view TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1,
    vault_origin TEXT NOT NULL DEFAULT 'native'
  );
  CREATE TABLE IF NOT EXISTS agent_views (
    deliberation_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    register TEXT NOT NULL,
    interpretation TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (deliberation_id, agent_name)
  );
  CREATE TABLE IF NOT EXISTS corrections (
    id TEXT PRIMARY KEY,
    deliberation_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    agent TEXT NOT NULL,
    tag TEXT,
    reason TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    vault_origin TEXT NOT NULL DEFAULT 'native'
  );
  CREATE INDEX IF NOT EXISTS idx_signal_events_timestamp ON signal_events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_deliberations_timestamp ON deliberations(timestamp);
  CREATE INDEX IF NOT EXISTS idx_corrections_delib       ON corrections(deliberation_id);
  CREATE INDEX IF NOT EXISTS idx_agent_views_delib       ON agent_views(deliberation_id);
`;

/**
 * Wrap node:sqlite's DatabaseSync so callers can use the better-sqlite3-style
 * `db.prepare(sql).run(...)` / `.get(...)` / `.all(...)` surface the rest of
 * the front-door code (ported from the private substrate) expects.
 */
class TasteVault {
  constructor(dbPath) {
    this._db = new DatabaseSync(dbPath);
    this._db.exec("PRAGMA journal_mode = WAL;");
    this._db.exec("PRAGMA foreign_keys = ON;");
    this._db.exec(SCHEMA);
  }

  prepare(sql) {
    const stmt = this._db.prepare(sql);
    return {
      run: (...args) => stmt.run(...args),
      get: (...args) => stmt.get(...args),
      all: (...args) => stmt.all(...args),
    };
  }

  // better-sqlite3 exposes db.transaction(fn) -> callable. node:sqlite has no
  // direct equivalent; emulate with explicit BEGIN/COMMIT and ROLLBACK.
  transaction(fn) {
    return (...args) => {
      this._db.exec("BEGIN");
      try {
        const out = fn(...args);
        this._db.exec("COMMIT");
        return out;
      } catch (err) {
        this._db.exec("ROLLBACK");
        throw err;
      }
    };
  }

  close() {
    this._db.close();
  }
}

export function openVault() {
  const dir = vaultDir();
  fs.mkdirSync(dir, { recursive: true });
  return new TasteVault(vaultDbPath());
}
