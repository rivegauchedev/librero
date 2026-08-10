import "server-only"

import { sqlite } from "@/db"
import type { ExportRow } from "@/lib/csv"

type Row = {
  title: string
  subtitle: string | null
  authors: string | null
  series: string | null
  seriesPosition: number | null
  firstPublishYear: number | null
  isbn13: string | null
  isbn10: string | null
  publisher: string | null
  publishYear: number | null
  pageCount: number | null
  language: string | null
  format: string | null
  editionNote: string | null
  medium: string | null
  quantity: number | null
  location: string | null
  condition: string | null
  acquiredDate: number | null
  purchasePriceCents: number | null
  readingStatus: string
  rating: number | null
  tags: string | null
  notes: string | null
  isWishlist: number
}

function value(input: string | number | null | undefined): string {
  return input === null || input === undefined ? "" : String(input)
}

/**
 * One row per copy, flattened. A work with two editions and three copies
 * exports as three rows — which is exactly what re-importing needs to
 * reconstruct it.
 *
 * LEFT JOINs throughout, so wishlist entries and editions with no copies still
 * appear; dropping them would make export/import lossy.
 */
export function exportRows(): ExportRow[] {
  const rows = sqlite
    .prepare(
      `SELECT
         w.title                                       AS title,
         w.subtitle                                    AS subtitle,
         (SELECT group_concat(a.name, '; ')
            FROM work_authors wa JOIN authors a ON a.id = wa.author_id
           WHERE wa.work_id = w.id AND wa.role = 'author') AS authors,
         (SELECT s.name FROM work_series ws JOIN series s ON s.id = ws.series_id
           WHERE ws.work_id = w.id LIMIT 1)            AS series,
         (SELECT ws.position FROM work_series ws
           WHERE ws.work_id = w.id LIMIT 1)            AS seriesPosition,
         w.first_publish_year                          AS firstPublishYear,
         e.isbn13                                      AS isbn13,
         e.isbn10                                      AS isbn10,
         e.publisher                                   AS publisher,
         e.publish_year                                AS publishYear,
         e.page_count                                  AS pageCount,
         e.language                                    AS language,
         e.format                                      AS format,
         e.edition_note                                AS editionNote,
         c.medium                                      AS medium,
         c.quantity                                    AS quantity,
         c.location                                    AS location,
         c.condition                                   AS condition,
         c.acquired_date                               AS acquiredDate,
         c.purchase_price_cents                        AS purchasePriceCents,
         w.reading_status                              AS readingStatus,
         w.rating                                      AS rating,
         (SELECT group_concat(t.name, '; ')
            FROM work_tags wt JOIN tags t ON t.id = wt.tag_id
           WHERE wt.work_id = w.id)                    AS tags,
         w.notes                                       AS notes,
         w.is_wishlist                                 AS isWishlist
       FROM works w
       LEFT JOIN editions e ON e.work_id = w.id
       LEFT JOIN copies c ON c.edition_id = e.id
       ORDER BY w.sort_title COLLATE NOCASE, e.id, c.id`
    )
    .all() as Row[]

  return rows.map((row) => ({
    title: row.title,
    subtitle: value(row.subtitle),
    authors: value(row.authors),
    series: value(row.series),
    series_position: value(row.seriesPosition),
    first_publish_year: value(row.firstPublishYear),
    isbn13: value(row.isbn13),
    isbn10: value(row.isbn10),
    publisher: value(row.publisher),
    publish_year: value(row.publishYear),
    page_count: value(row.pageCount),
    language: value(row.language),
    format: value(row.format),
    edition_note: value(row.editionNote),
    medium: value(row.medium),
    quantity: value(row.quantity),
    location: value(row.location),
    condition: value(row.condition),
    acquired_date: row.acquiredDate
      ? new Date(row.acquiredDate * 1000).toISOString().slice(0, 10)
      : "",
    purchase_price:
      row.purchasePriceCents === null ? "" : (row.purchasePriceCents / 100).toFixed(2),
    reading_status: row.readingStatus,
    rating: value(row.rating),
    tags: value(row.tags),
    notes: value(row.notes),
    wishlist: row.isWishlist ? "true" : "false",
  }))
}
