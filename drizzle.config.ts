import path from "node:path"
import { defineConfig } from "drizzle-kit"

const dataDir = path.resolve(process.env.LIBRERO_DATA_DIR ?? "./data")

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.LIBRERO_DB_PATH ?? path.join(dataDir, "librero.db"),
  },
  strict: true,
  verbose: true,
})
