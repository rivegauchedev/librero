import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { hashSync } from "@node-rs/argon2"

export const E2E_DATA_DIR = path.resolve("./.e2e-data")

/** Ready to use: password already chosen, so the first-run gate is behind them. */
export const E2E_ADMIN = { username: "e2e-admin", password: "e2e-password-123" }

/** Freshly invited: still holds an admin-issued temporary password. */
export const E2E_NEWCOMER = { username: "e2e-newcomer", password: "e2e-temp-password-9" }

/**
 * Fresh database for every run, with two users.
 *
 * Two rather than one so no test depends on another having run first: the
 * first-run password-change flow needs an account with a temporary password,
 * and every other test needs one without.
 *
 * Called from playwright.config.ts at module scope so it completes before the
 * web server starts. Synchronous because Playwright loads the config as CJS,
 * where there is no top-level await.
 */
export function prepareDatabase() {
  fs.rmSync(E2E_DATA_DIR, { recursive: true, force: true })
  fs.mkdirSync(path.join(E2E_DATA_DIR, "uploads"), { recursive: true })

  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, LIBRERO_DATA_DIR: E2E_DATA_DIR },
    stdio: "inherit",
  })

  const db = new Database(path.join(E2E_DATA_DIR, "librero.db"))
  const insert = db.prepare(
    `INSERT INTO users (username, display_name, password_hash, role, must_change_password)
     VALUES (?, ?, ?, 'admin', ?)`
  )

  // Same parameters as src/lib/password.ts.
  const argon = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

  insert.run(
    E2E_ADMIN.username,
    "E2E Admin",
    hashSync(E2E_ADMIN.password, argon),
    0
  )
  insert.run(
    E2E_NEWCOMER.username,
    "E2E Newcomer",
    hashSync(E2E_NEWCOMER.password, argon),
    1
  )

  db.close()
}
