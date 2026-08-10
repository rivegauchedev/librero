/**
 * Creates the first administrator on an empty database.
 *
 * Idempotent: if any user already exists it does nothing, so the Docker
 * entrypoint can call it on every boot. Plain JavaScript for the same reason as
 * migrate.mjs — it runs inside the production image.
 */
import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { hash } from "@node-rs/argon2"

const dataDir = path.resolve(process.env.LIBRERO_DATA_DIR ?? "./data")
const dbPath = process.env.LIBRERO_DB_PATH ?? path.join(dataDir, "librero.db")

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath} — run the migrations first.`)
  process.exit(1)
}

const username = process.env.ADMIN_USERNAME ?? "admin"
const password = process.env.ADMIN_PASSWORD

if (!password) {
  console.error("ADMIN_PASSWORD is not set — refusing to create an admin without one.")
  process.exit(1)
}
if (password.length < 10) {
  console.error("ADMIN_PASSWORD must be at least 10 characters.")
  process.exit(1)
}

const db = new Database(dbPath)
db.pragma("foreign_keys = ON")

const { count } = db.prepare("SELECT count(*) AS count FROM users").get()

if (count > 0) {
  console.log(`${count} user(s) already exist — leaving them alone.`)
  db.close()
  process.exit(0)
}

// Must match the parameters in src/lib/password.ts.
const passwordHash = await hash(password, {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
})

db.prepare(
  `INSERT INTO users (username, display_name, password_hash, role, must_change_password)
   VALUES (?, ?, ?, 'admin', 1)`
).run(username, username, passwordHash)

console.log(
  `Created administrator "${username}". You will be asked to change the password on first sign-in.`
)
db.close()
