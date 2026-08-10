import "server-only"

import { sqlite } from "@/db"
import { searchFts } from "@/db/fts"
import { getWorksByIds, type WorkListRow } from "@/db/queries/works"
import { parseIsbn } from "@/lib/isbn"
import { toFtsQuery } from "@/lib/text"

/**
 * Search the local catalogue. An ISBN goes straight to an exact edition lookup;
 * anything else goes through FTS5, which covers titles, authors, series and
 * ISBNs at once.
 */
export function searchLibrary(query: string, limit = 25): WorkListRow[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const isbn = parseIsbn(trimmed)
  if (isbn) {
    const rows = sqlite
      .prepare(
        `SELECT DISTINCT work_id AS workId FROM editions
          WHERE (isbn13 IS NOT NULL AND isbn13 = ?)
             OR (isbn10 IS NOT NULL AND isbn10 = ?)`
      )
      .all(isbn.isbn13 ?? "", isbn.isbn10 ?? "") as { workId: number }[]
    if (rows.length > 0) {
      return getWorksByIds(rows.map((row) => row.workId))
    }
  }

  const hits = searchFts(toFtsQuery(trimmed), limit)
  if (hits.length === 0) return []

  // FTS returns best-first; getWorksByIds does not preserve that, so re-sort.
  const order = new Map(hits.map((hit, index) => [hit.workId, index]))
  return getWorksByIds(hits.map((hit) => hit.workId)).sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  )
}
