import "server-only"

import { sqlite } from "@/db"

const TTL_DAYS = 30
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60

/**
 * Provider responses are cached in SQLite rather than in memory: repeat scans of
 * the same book stay instant across restarts, and it keeps us well inside Open
 * Library's rate limits without any coordination.
 */
export function readCache<T>(provider: string, key: string): T | undefined {
  const row = sqlite
    .prepare(
      `SELECT payload FROM metadata_cache
        WHERE provider = ? AND key = ? AND expires_at > unixepoch()`
    )
    .get(provider, key) as { payload: string } | undefined

  if (!row) return undefined
  try {
    return JSON.parse(row.payload) as T
  } catch {
    return undefined
  }
}

export function writeCache(provider: string, key: string, value: unknown): void {
  sqlite
    .prepare(
      `INSERT INTO metadata_cache (provider, key, payload, fetched_at, expires_at)
       VALUES (?, ?, ?, unixepoch(), unixepoch() + ?)
       ON CONFLICT(provider, key) DO UPDATE SET
         payload = excluded.payload,
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at`
    )
    .run(provider, key, JSON.stringify(value), TTL_SECONDS)
}

/**
 * Read-through cache around a provider call.
 *
 * An empty answer is never cached. The providers swallow their own failures and
 * return null, so a timeout or a rate limit is indistinguishable from "no such
 * book" at this layer — and caching that for 30 days turns one slow afternoon
 * into a month of a real book reporting as unknown. Only a result worth keeping
 * gets kept.
 */
export async function cached<T>(
  provider: string,
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const hit = readCache<T>(provider, key)
  if (hit !== undefined && hit !== null) return hit

  const value = await load()
  const worthCaching =
    value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)

  if (worthCaching) writeCache(provider, key, value)
  return value
}

/** Drop every cached provider response. Used by `npm run cache:clear`. */
export function clearCache(): number {
  return sqlite.prepare("DELETE FROM metadata_cache").run().changes
}

export function purgeExpiredCache(): number {
  return sqlite.prepare("DELETE FROM metadata_cache WHERE expires_at <= unixepoch()")
    .run().changes
}
