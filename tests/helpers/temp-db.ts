import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/**
 * Point LIBRERO_DB_PATH at a throwaway file and run the real migrations against
 * it. Tests exercise the same schema, triggers and FTS table the app uses —
 * a hand-written test schema would drift.
 *
 * Must be called before any import of "@/db", which opens the connection on
 * first evaluation.
 */
export function createTempDatabase(): { dir: string; dbPath: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "librero-test-"))
  const dbPath = path.join(dir, "librero.db")

  process.env.LIBRERO_DATA_DIR = dir
  process.env.LIBRERO_DB_PATH = dbPath

  return {
    dir,
    dbPath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  }
}
