import "server-only"

import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"

import * as schema from "@/db/schema"
import { DB_PATH } from "@/lib/paths"

/**
 * Exactly one connection per process, cached on globalThis.
 *
 * The cache is *not* conditional on NODE_ENV. Next compiles route handlers,
 * Server Actions and pages into separate module graphs, so a per-module
 * connection means several handles on the same file — and a read on one handle
 * can miss a write just committed on another. That showed up as "add a book,
 * search for it, be told you don't own it".
 *
 * It also covers the dev server re-evaluating modules on every edit, which is
 * the usual reason for this pattern.
 */
const globalForDb = globalThis as unknown as {
  librero_sqlite?: Database.Database
}

function openDatabase(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

  const sqlite = new Database(DB_PATH)
  // WAL keeps reads from blocking the single writer; the rest are the standard
  // durability/consistency settings for an embedded app database.
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("synchronous = NORMAL")
  sqlite.pragma("foreign_keys = ON")
  sqlite.pragma("busy_timeout = 5000")
  return sqlite
}

export const sqlite = (globalForDb.librero_sqlite ??= openDatabase())

export const db = drizzle(sqlite, { schema })

export { schema }
