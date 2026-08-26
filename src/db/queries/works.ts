import "server-only"

import { sqlite } from "@/db"
import { listLoansForWork, type CopyLoan } from "@/db/queries/loans"
import type {
  CopyMedium,
  EditionFormat,
  FileFormat,
  ReadingStatus,
} from "@/db/schema"

/** One row of the library list: a work flattened with its aggregate copy info. */
export type WorkListRow = {
  id: number
  title: string
  subtitle: string | null
  sortTitle: string
  authors: string
  series: string | null
  firstPublishYear: number | null
  readingStatus: ReadingStatus
  rating: number | null
  /** Page you are on, or null when progress is not being tracked. */
  currentPage: number | null
  /** Pages in the edition we are showing, so `currentPage` can become a bar. */
  pageCount: number | null
  isWishlist: boolean
  /** Distinct formats owned, e.g. "paperback,ebook" — split before rendering. */
  formats: string
  editionCount: number
  copyCount: number
  /** True while any copy of this work is out on an open loan. */
  onLoan: boolean
  coverPath: string | null
  locations: string | null
  addedAt: number
}

const WORK_LIST_SQL = `
  SELECT
    w.id                                       AS id,
    w.title                                    AS title,
    w.subtitle                                 AS subtitle,
    w.sort_title                               AS sortTitle,
    COALESCE((SELECT group_concat(a.name, ', ')
                FROM work_authors wa
                JOIN authors a ON a.id = wa.author_id
               WHERE wa.work_id = w.id AND wa.role = 'author'
               ORDER BY wa.position), '')      AS authors,
    (SELECT s.name FROM work_series ws
       JOIN series s ON s.id = ws.series_id
      WHERE ws.work_id = w.id LIMIT 1)         AS series,
    w.first_publish_year                       AS firstPublishYear,
    w.reading_status                           AS readingStatus,
    w.rating                                   AS rating,
    w.current_page                             AS currentPage,
    (SELECT e.page_count FROM editions e
      WHERE e.work_id = w.id AND e.page_count IS NOT NULL
      ORDER BY e.id LIMIT 1)                   AS pageCount,
    w.is_wishlist                              AS isWishlist,
    COALESCE((SELECT group_concat(DISTINCT e.format)
                FROM editions e
                JOIN copies c ON c.edition_id = e.id
               WHERE e.work_id = w.id), '')    AS formats,
    (SELECT count(*) FROM editions e
      WHERE e.work_id = w.id)                  AS editionCount,
    COALESCE((SELECT sum(c.quantity)
                FROM editions e
                JOIN copies c ON c.edition_id = e.id
               WHERE e.work_id = w.id), 0)     AS copyCount,
    EXISTS (SELECT 1 FROM editions e
              JOIN copies c ON c.edition_id = e.id
              JOIN loans l ON l.copy_id = c.id
             WHERE e.work_id = w.id AND l.returned_at IS NULL) AS onLoan,
    (SELECT e.cover_path FROM editions e
      WHERE e.work_id = w.id AND e.cover_path IS NOT NULL
      LIMIT 1)                                 AS coverPath,
    (SELECT group_concat(DISTINCT c.location)
       FROM editions e JOIN copies c ON c.edition_id = e.id
      WHERE e.work_id = w.id AND c.location IS NOT NULL) AS locations,
    w.created_at                               AS addedAt
  FROM works w
`

function toRows(rows: unknown[]): WorkListRow[] {
  // SQLite has no boolean type; both of these come back as 0 or 1.
  return (
    rows as (Omit<WorkListRow, "isWishlist" | "onLoan"> & {
      isWishlist: number
      onLoan: number
    })[]
  ).map((row) => ({
    ...row,
    isWishlist: Boolean(row.isWishlist),
    onLoan: Boolean(row.onLoan),
  }))
}

export function listWorks(): WorkListRow[] {
  return toRows(
    sqlite
      .prepare(`${WORK_LIST_SQL} WHERE w.is_wishlist = 0 ORDER BY w.sort_title COLLATE NOCASE`)
      .all()
  )
}

export function listWishlist(): WorkListRow[] {
  return toRows(
    sqlite
      .prepare(`${WORK_LIST_SQL} WHERE w.is_wishlist = 1 ORDER BY w.created_at DESC`)
      .all()
  )
}

export function listRecentlyAdded(limit = 8): WorkListRow[] {
  return toRows(
    sqlite
      .prepare(
        `${WORK_LIST_SQL} WHERE w.is_wishlist = 0 ORDER BY w.created_at DESC LIMIT ?`
      )
      .all(limit)
  )
}

export function listCurrentlyReading(): WorkListRow[] {
  return toRows(
    sqlite
      .prepare(
        `${WORK_LIST_SQL} WHERE w.is_wishlist = 0 AND w.reading_status = 'reading'
         ORDER BY w.updated_at DESC`
      )
      .all()
  )
}

export function getWorksByIds(ids: number[]): WorkListRow[] {
  if (ids.length === 0) return []
  const placeholders = ids.map(() => "?").join(",")
  return toRows(
    sqlite.prepare(`${WORK_LIST_SQL} WHERE w.id IN (${placeholders})`).all(...ids)
  )
}

/* ------------------------------------------------------- single work view */

export type CopyDetail = {
  id: number
  medium: CopyMedium
  quantity: number
  condition: string | null
  acquiredDate: number | null
  purchasePriceCents: number | null
  location: string | null
  notes: string | null
  fileFormat: FileFormat | null
  externalService: string | null
  /** Newest first. At most one of these is "pending" — see queries/loans.ts. */
  loans: CopyLoan[]
}

export type EditionDetail = {
  id: number
  isbn10: string | null
  isbn13: string | null
  title: string | null
  publisher: string | null
  publishYear: number | null
  pageCount: number | null
  language: string | null
  format: EditionFormat
  editionNote: string | null
  coverPath: string | null
  coverSourceUrl: string | null
  copies: CopyDetail[]
}

export type WorkDetail = {
  id: number
  title: string
  subtitle: string | null
  description: string | null
  firstPublishYear: number | null
  originalLanguage: string | null
  readingStatus: ReadingStatus
  rating: number | null
  currentPage: number | null
  dateFinished: number | null
  notes: string | null
  isWishlist: boolean
  openLibraryWorkId: string | null
  authors: { id: number; name: string; role: string }[]
  series: { id: number; name: string; position: number | null }[]
  tags: { id: number; name: string }[]
  editions: EditionDetail[]
}

export function getWorkDetail(workId: number): WorkDetail | null {
  const work = sqlite
    .prepare(
      `SELECT id, title, subtitle, description, first_publish_year AS firstPublishYear,
              original_language AS originalLanguage, reading_status AS readingStatus,
              rating, current_page AS currentPage, date_finished AS dateFinished,
              notes, is_wishlist AS isWishlist,
              open_library_work_id AS openLibraryWorkId
         FROM works WHERE id = ?`
    )
    .get(workId) as (Omit<WorkDetail, "isWishlist" | "authors" | "series" | "tags" | "editions"> & {
    isWishlist: number
  }) | undefined

  if (!work) return null

  const authors = sqlite
    .prepare(
      `SELECT a.id, a.name, wa.role
         FROM work_authors wa JOIN authors a ON a.id = wa.author_id
        WHERE wa.work_id = ? ORDER BY wa.role, wa.position`
    )
    .all(workId) as WorkDetail["authors"]

  const series = sqlite
    .prepare(
      `SELECT s.id, s.name, ws.position
         FROM work_series ws JOIN series s ON s.id = ws.series_id
        WHERE ws.work_id = ?`
    )
    .all(workId) as WorkDetail["series"]

  const tags = sqlite
    .prepare(
      `SELECT t.id, t.name FROM work_tags wt JOIN tags t ON t.id = wt.tag_id
        WHERE wt.work_id = ? ORDER BY t.name COLLATE NOCASE`
    )
    .all(workId) as WorkDetail["tags"]

  const editions = sqlite
    .prepare(
      `SELECT id, isbn10, isbn13, title, publisher, publish_year AS publishYear,
              page_count AS pageCount, language, format, edition_note AS editionNote,
              cover_path AS coverPath, cover_source_url AS coverSourceUrl
         FROM editions WHERE work_id = ? ORDER BY publish_year, id`
    )
    .all(workId) as Omit<EditionDetail, "copies">[]

  const copyStmt = sqlite.prepare(
    `SELECT id, medium, quantity, condition, acquired_date AS acquiredDate,
            purchase_price_cents AS purchasePriceCents, location, notes,
            file_format AS fileFormat, external_service AS externalService
       FROM copies WHERE edition_id = ? ORDER BY id`
  )

  /* One query for the whole work, then grouped in JS — a copy usually has no
     loans at all, and a statement per copy would mostly return nothing. */
  const loansByCopy = new Map<number, CopyLoan[]>()
  for (const loan of listLoansForWork(workId)) {
    const existing = loansByCopy.get(loan.copyId)
    if (existing) existing.push(loan)
    else loansByCopy.set(loan.copyId, [loan])
  }

  return {
    ...work,
    isWishlist: Boolean(work.isWishlist),
    authors,
    series,
    tags,
    editions: editions.map((edition) => ({
      ...edition,
      copies: (copyStmt.all(edition.id) as Omit<CopyDetail, "loans">[]).map((copy) => ({
        ...copy,
        loans: loansByCopy.get(copy.id) ?? [],
      })),
    })),
  }
}

/* ------------------------------------------------------------- by location */

/**
 * Every (work, location) pair, so the shelves view can draw one rail per place.
 * A book with copies in two rooms appears on both rails — which is the truth
 * about where it is, and the whole reason the view exists.
 *
 * The joins are outer and the query starts from `works` on purpose. An older
 * catalogue is full of books recorded before anyone held them: editions with no
 * copies, and works with no editions at all. An inner join drops those, and the
 * shelves view would then quietly show fewer books than the heading counts. They
 * come back with a null location instead, which puts them in the unshelved
 * bucket — where a book you own but have not placed actually belongs.
 */
export function listWorkLocations(): { workId: number; location: string | null }[] {
  return sqlite
    .prepare(
      `SELECT DISTINCT w.id AS workId, c.location AS location
         FROM works w
         LEFT JOIN editions e ON e.work_id = w.id
         LEFT JOIN copies c ON c.edition_id = e.id
        WHERE w.is_wishlist = 0`
    )
    .all() as { workId: number; location: string | null }[]
}
