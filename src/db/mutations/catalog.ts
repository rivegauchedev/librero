import "server-only"

import { sqlite } from "@/db"
import { reindexWork } from "@/db/fts"
import type { EditionFormat } from "@/db/schema"
import { parseIsbn } from "@/lib/isbn"
import {
  toAuthorMatchKey,
  toSortName,
  toSortTitle,
  toTitleMatchKey,
} from "@/lib/text"
import type { NormalizedBook } from "@/lib/providers/types"

/*
 * All catalogue writes funnel through here. Every function is synchronous
 * (better-sqlite3) so it can run inside one `sqlite.transaction()` — the FTS
 * index and the rows it describes must never be able to drift apart.
 */

function upsertAuthor(name: string): number {
  const trimmed = name.trim()
  const existing = sqlite
    .prepare("SELECT id FROM authors WHERE lower(name) = lower(?)")
    .get(trimmed) as { id: number } | undefined
  if (existing) return existing.id

  const result = sqlite
    .prepare(
      "INSERT INTO authors (name, sort_name, match_key, open_library_author_id) VALUES (?, ?, ?, NULL)"
    )
    .run(trimmed, toSortName(trimmed), toAuthorMatchKey(trimmed))
  return Number(result.lastInsertRowid)
}

function upsertSeries(name: string): number {
  const trimmed = name.trim()
  const existing = sqlite
    .prepare("SELECT id FROM series WHERE lower(name) = lower(?)")
    .get(trimmed) as { id: number } | undefined
  if (existing) return existing.id

  return Number(sqlite.prepare("INSERT INTO series (name) VALUES (?)").run(trimmed).lastInsertRowid)
}

function upsertTag(name: string): number {
  const trimmed = name.trim()
  const existing = sqlite
    .prepare("SELECT id FROM tags WHERE lower(name) = lower(?)")
    .get(trimmed) as { id: number } | undefined
  if (existing) return existing.id

  return Number(sqlite.prepare("INSERT INTO tags (name) VALUES (?)").run(trimmed).lastInsertRowid)
}

export function setWorkAuthors(workId: number, names: string[]): void {
  sqlite.prepare("DELETE FROM work_authors WHERE work_id = ?").run(workId)
  const insert = sqlite.prepare(
    "INSERT OR IGNORE INTO work_authors (work_id, author_id, role, position) VALUES (?, ?, 'author', ?)"
  )
  names
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name, index) => insert.run(workId, upsertAuthor(name), index))
}

export function setWorkTags(workId: number, names: string[]): void {
  sqlite.prepare("DELETE FROM work_tags WHERE work_id = ?").run(workId)
  const insert = sqlite.prepare(
    "INSERT OR IGNORE INTO work_tags (work_id, tag_id) VALUES (?, ?)"
  )
  names
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => insert.run(workId, upsertTag(name)))
}

export function setWorkSeries(
  workId: number,
  series: { name: string; position: number | null } | null
): void {
  sqlite.prepare("DELETE FROM work_series WHERE work_id = ?").run(workId)
  if (!series?.name.trim()) return
  sqlite
    .prepare("INSERT INTO work_series (work_id, series_id, position) VALUES (?, ?, ?)")
    .run(workId, upsertSeries(series.name), series.position)
}

/* ------------------------------------------------------------------ works */

export type WorkInput = {
  title: string
  subtitle?: string | null
  description?: string | null
  firstPublishYear?: number | null
  originalLanguage?: string | null
  openLibraryWorkId?: string | null
  isWishlist?: boolean
  authors?: string[]
  tags?: string[]
  series?: { name: string; position: number | null } | null
}

export function createWork(input: WorkInput): number {
  const result = sqlite
    .prepare(
      `INSERT INTO works
         (title, subtitle, sort_title, match_key, original_language, first_publish_year,
          description, open_library_work_id, is_wishlist)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.title,
      input.subtitle ?? null,
      toSortTitle(input.title),
      toTitleMatchKey(input.title),
      input.originalLanguage ?? null,
      input.firstPublishYear ?? null,
      input.description ?? null,
      input.openLibraryWorkId ?? null,
      input.isWishlist ? 1 : 0
    )

  const workId = Number(result.lastInsertRowid)
  if (input.authors) setWorkAuthors(workId, input.authors)
  if (input.tags) setWorkTags(workId, input.tags)
  if (input.series !== undefined) setWorkSeries(workId, input.series)
  reindexWork(workId)
  return workId
}

export function updateWork(workId: number, input: WorkInput): void {
  sqlite
    .prepare(
      `UPDATE works SET
         title = ?, subtitle = ?, sort_title = ?, match_key = ?,
         original_language = ?, first_publish_year = ?, description = ?,
         updated_at = unixepoch()
       WHERE id = ?`
    )
    .run(
      input.title,
      input.subtitle ?? null,
      toSortTitle(input.title),
      toTitleMatchKey(input.title),
      input.originalLanguage ?? null,
      input.firstPublishYear ?? null,
      input.description ?? null,
      workId
    )

  if (input.authors) setWorkAuthors(workId, input.authors)
  if (input.tags) setWorkTags(workId, input.tags)
  if (input.series !== undefined) setWorkSeries(workId, input.series)
  reindexWork(workId)
}

export function deleteWork(workId: number): void {
  // Editions and copies go with it via ON DELETE CASCADE; the FTS row is
  // removed by the works_after_delete_fts trigger.
  sqlite.prepare("DELETE FROM works WHERE id = ?").run(workId)
}

export function findWorkByOpenLibraryId(workId: string): number | null {
  const row = sqlite
    .prepare("SELECT id FROM works WHERE open_library_work_id = ?")
    .get(workId) as { id: number } | undefined
  return row?.id ?? null
}

/* --------------------------------------------------------------- editions */

export type EditionInput = {
  workId: number
  isbn10?: string | null
  isbn13?: string | null
  title?: string | null
  publisher?: string | null
  publishYear?: number | null
  pageCount?: number | null
  language?: string | null
  format: EditionFormat
  editionNote?: string | null
  coverPath?: string | null
  coverSourceUrl?: string | null
  openLibraryEditionId?: string | null
  metadataSource?: "openlibrary" | "googlebooks" | "manual"
}

export function createEdition(input: EditionInput): number {
  const result = sqlite
    .prepare(
      `INSERT INTO editions
         (work_id, isbn10, isbn13, title, publisher, publish_year, page_count, language,
          format, edition_note, cover_path, cover_source_url, open_library_edition_id,
          metadata_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.workId,
      input.isbn10 ?? null,
      input.isbn13 ?? null,
      input.title ?? null,
      input.publisher ?? null,
      input.publishYear ?? null,
      input.pageCount ?? null,
      input.language ?? null,
      input.format,
      input.editionNote ?? null,
      input.coverPath ?? null,
      input.coverSourceUrl ?? null,
      input.openLibraryEditionId ?? null,
      input.metadataSource ?? "manual"
    )

  reindexWork(input.workId)
  return Number(result.lastInsertRowid)
}

export function updateEdition(editionId: number, input: Omit<EditionInput, "workId">): void {
  sqlite
    .prepare(
      `UPDATE editions SET
         isbn10 = ?, isbn13 = ?, title = ?, publisher = ?, publish_year = ?,
         page_count = ?, language = ?, format = ?, edition_note = ?,
         updated_at = unixepoch()
       WHERE id = ?`
    )
    .run(
      input.isbn10 ?? null,
      input.isbn13 ?? null,
      input.title ?? null,
      input.publisher ?? null,
      input.publishYear ?? null,
      input.pageCount ?? null,
      input.language ?? null,
      input.format,
      input.editionNote ?? null,
      editionId
    )

  const row = sqlite
    .prepare("SELECT work_id AS workId FROM editions WHERE id = ?")
    .get(editionId) as { workId: number } | undefined
  if (row) reindexWork(row.workId)
}

export function deleteEdition(editionId: number): void {
  const row = sqlite
    .prepare("SELECT work_id AS workId FROM editions WHERE id = ?")
    .get(editionId) as { workId: number } | undefined
  sqlite.prepare("DELETE FROM editions WHERE id = ?").run(editionId)
  if (row) reindexWork(row.workId)
}

/**
 * Fallback work matching for records with no Open Library id (Google Books, CSV
 * imports). Requires *both* a normalized-title and a surname match — title
 * alone would happily merge every book called "Ulysses".
 */
export function findWorkByTitleAndAuthor(
  title: string,
  primaryAuthor: string | null
): number | null {
  if (!primaryAuthor) return null

  const row = sqlite
    .prepare(
      `SELECT w.id FROM works w
         JOIN work_authors wa ON wa.work_id = w.id AND wa.role = 'author'
         JOIN authors a ON a.id = wa.author_id
        WHERE w.match_key = ? AND a.match_key = ?
        LIMIT 1`
    )
    .get(toTitleMatchKey(title), toAuthorMatchKey(primaryAuthor)) as
    | { id: number }
    | undefined

  return row?.id ?? null
}

export function findEditionByIsbn(isbn13: string): number | null {
  const row = sqlite
    .prepare("SELECT id FROM editions WHERE isbn13 = ?")
    .get(isbn13) as { id: number } | undefined
  return row?.id ?? null
}

/* ----------------------------------------------------------------- copies */

export type CopyInput = {
  editionId: number
  medium: "physical" | "digital"
  quantity: number
  condition?: string | null
  acquiredDate?: Date | null
  purchasePriceCents?: number | null
  location?: string | null
  notes?: string | null
  fileName?: string | null
  filePath?: string | null
  fileSizeBytes?: number | null
  fileFormat?: string | null
  externalService?: string | null
}

function toUnix(date: Date | null | undefined): number | null {
  return date ? Math.floor(date.getTime() / 1000) : null
}

export function createCopy(input: CopyInput): number {
  const result = sqlite
    .prepare(
      `INSERT INTO copies
         (edition_id, medium, quantity, condition, acquired_date, purchase_price_cents,
          location, notes, file_name, file_path, file_size_bytes, file_format,
          external_service)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.editionId,
      input.medium,
      input.quantity,
      input.condition ?? null,
      toUnix(input.acquiredDate),
      input.purchasePriceCents ?? null,
      input.location ?? null,
      input.notes ?? null,
      input.fileName ?? null,
      input.filePath ?? null,
      input.fileSizeBytes ?? null,
      input.fileFormat ?? null,
      input.externalService ?? null
    )

  clearWishlistFlagForEdition(input.editionId)
  return Number(result.lastInsertRowid)
}

export function updateCopy(copyId: number, input: Omit<CopyInput, "editionId" | "medium">): void {
  sqlite
    .prepare(
      `UPDATE copies SET
         quantity = ?, condition = ?, acquired_date = ?, purchase_price_cents = ?,
         location = ?, notes = ?, external_service = ?, updated_at = unixepoch()
       WHERE id = ?`
    )
    .run(
      input.quantity,
      input.condition ?? null,
      toUnix(input.acquiredDate),
      input.purchasePriceCents ?? null,
      input.location ?? null,
      input.notes ?? null,
      input.externalService ?? null,
      copyId
    )
}

export function deleteCopy(copyId: number): void {
  sqlite.prepare("DELETE FROM copies WHERE id = ?").run(copyId)
}

/** Owning a copy is what takes a book off the wishlist — the flag is derived. */
function clearWishlistFlagForEdition(editionId: number): void {
  sqlite
    .prepare(
      `UPDATE works SET is_wishlist = 0, updated_at = unixepoch()
        WHERE is_wishlist = 1
          AND id = (SELECT work_id FROM editions WHERE id = ?)`
    )
    .run(editionId)
}

/* ------------------------------------------------ import a provider record */

export type ImportResult = {
  workId: number
  editionId: number
  /** True when this ISBN already had an edition row and we reused it. */
  reusedEdition: boolean
}

/**
 * Turn a provider record into work + edition rows, reusing what already exists.
 *
 * Matching order matters: an exact ISBN-13 hit means we already have this exact
 * printing, and a matching Open Library work id means we own a different
 * printing of the same book and should hang the new edition off it.
 *
 * Runs in one transaction so a half-written book can never appear in search.
 */
export function importBook(
  book: NormalizedBook,
  options: { coverPath?: string | null; asWishlist?: boolean; format?: EditionFormat } = {}
): ImportResult {
  const run = sqlite.transaction((): ImportResult => {
    const isbn = book.isbn13 ? parseIsbn(book.isbn13) : null
    const isbn13 = isbn?.isbn13 ?? null
    const isbn10 = isbn?.isbn10 ?? book.isbn10 ?? null

    if (isbn13) {
      const existingEdition = findEditionByIsbn(isbn13)
      if (existingEdition) {
        const row = sqlite
          .prepare("SELECT work_id AS workId FROM editions WHERE id = ?")
          .get(existingEdition) as { workId: number }
        return { workId: row.workId, editionId: existingEdition, reusedEdition: true }
      }
    }

    const workId =
      (book.openLibraryWorkId
        ? findWorkByOpenLibraryId(book.openLibraryWorkId)
        : null) ??
      findWorkByTitleAndAuthor(book.title, book.authors[0] ?? null) ??
      createWork({
        title: book.title,
        subtitle: book.subtitle,
        description: book.description,
        firstPublishYear: book.firstPublishYear,
        originalLanguage: book.language,
        openLibraryWorkId: book.openLibraryWorkId,
        isWishlist: options.asWishlist ?? false,
        authors: book.authors,
        tags: book.subjects,
        series: book.series,
      })

    const editionId = createEdition({
      workId,
      isbn10,
      isbn13,
      // Edition titles are only stored when they differ from the work's; a
      // provider record gives us no reason to think it does.
      title: null,
      publisher: book.publisher,
      publishYear: book.publishYear,
      pageCount: book.pageCount,
      language: book.language,
      format: options.format ?? book.format ?? "paperback",
      coverPath: options.coverPath ?? null,
      coverSourceUrl: book.coverUrl,
      openLibraryEditionId: book.openLibraryEditionId,
      metadataSource: book.source,
    })

    return { workId, editionId, reusedEdition: false }
  })

  return run()
}
