import "server-only"

import { sqlite } from "@/db"

/**
 * Rebuild the FTS row for one work from its current authors, ISBNs and series.
 *
 * Call this inside the same transaction as any mutation that touches a work's
 * title, authors, series or editions. It is a delete-then-insert rather than an
 * update because the searchable text is an aggregate over five tables, and
 * recomputing it wholesale is both simpler and cheaper than diffing.
 */
export function reindexWork(workId: number): void {
  const row = sqlite
    .prepare<[number, number, number, number]>(
      `SELECT
         w.title                                              AS title,
         COALESCE(w.subtitle, '')                             AS subtitle,
         COALESCE((SELECT group_concat(a.name, ' ')
                     FROM work_authors wa
                     JOIN authors a ON a.id = wa.author_id
                    WHERE wa.work_id = ?), '')                AS authors,
         COALESCE((SELECT group_concat(
                            COALESCE(e.isbn13, '') || ' ' || COALESCE(e.isbn10, ''), ' ')
                     FROM editions e
                    WHERE e.work_id = ?), '')                 AS isbns,
         COALESCE((SELECT group_concat(s.name, ' ')
                     FROM work_series ws
                     JOIN series s ON s.id = ws.series_id
                    WHERE ws.work_id = ?), '')                AS series
       FROM works w
      WHERE w.id = ?`
    )
    .get(workId, workId, workId, workId) as
    | { title: string; subtitle: string; authors: string; isbns: string; series: string }
    | undefined

  sqlite.prepare("DELETE FROM works_fts WHERE work_id = ?").run(workId)
  if (!row) return

  sqlite
    .prepare(
      `INSERT INTO works_fts (title, subtitle, authors, isbns, series, work_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(row.title, row.subtitle, row.authors, row.isbns, row.series, workId)
}

/** Rebuild the entire index. Used after a CSV import and by the repair script. */
export function reindexAll(): number {
  const ids = sqlite.prepare("SELECT id FROM works").all() as { id: number }[]
  const run = sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM works_fts").run()
    for (const { id } of ids) reindexWork(id)
  })
  run()
  return ids.length
}

export type FtsHit = { workId: number; rank: number }

/** Run an FTS5 MATCH query, best matches first. `query` must come from `toFtsQuery`. */
export function searchFts(query: string, limit = 50): FtsHit[] {
  if (!query) return []
  try {
    return sqlite
      .prepare(
        `SELECT work_id AS workId, rank
           FROM works_fts
          WHERE works_fts MATCH ?
          ORDER BY rank
          LIMIT ?`
      )
      .all(query, limit) as FtsHit[]
  } catch {
    // A malformed MATCH expression is a user-input problem, not a server error.
    return []
  }
}
