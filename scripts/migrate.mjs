/**
 * Applies pending Drizzle migrations. Run on every deploy — the Docker
 * entrypoint calls it before starting the server.
 *
 * Plain JavaScript on purpose: this runs inside the production image, and
 * keeping it free of TypeScript means the runtime stage does not have to ship
 * tsx and esbuild just to boot.
 */
import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"

const dataDir = path.resolve(process.env.LIBRERO_DATA_DIR ?? "./data")
const dbPath = process.env.LIBRERO_DB_PATH ?? path.join(dataDir, "librero.db")

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")

migrate(drizzle(sqlite), { migrationsFolder: "./src/db/migrations" })
sqlite.close()

console.log(`Migrations applied to ${dbPath}`)
