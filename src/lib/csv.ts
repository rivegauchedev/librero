import "server-only"

import { parse } from "csv-parse/sync"
import { stringify } from "csv-stringify/sync"

import type { EditionFormat } from "@/db/schema"
import { parseIsbn } from "@/lib/isbn"

/*
 * Two CSV dialects are supported on import:
 *
 *   - Librero's own export, which round-trips losslessly.
 *   - Goodreads' export, because that is what most people already have.
 *
 * The dialect is detected from the header row rather than asked for, since
 * getting it wrong is obvious from the preview and asking is one more thing to
 * get wrong.
 */

export const LIBRERO_COLUMNS = [
  "title",
  "subtitle",
  "authors",
  "series",
  "series_position",
  "first_publish_year",
  "isbn13",
  "isbn10",
  "publisher",
  "publish_year",
  "page_count",
  "language",
  "format",
  "edition_note",
  "medium",
  "quantity",
  "location",
  "condition",
  "acquired_date",
  "purchase_price",
  "reading_status",
  "rating",
  "current_page",
  "tags",
  "notes",
  "wishlist",
] as const

export type ImportRow = {
  title: string
  subtitle: string | null
  authors: string[]
  series: string | null
  seriesPosition: number | null
  firstPublishYear: number | null
  isbn13: string | null
  isbn10: string | null
  publisher: string | null
  publishYear: number | null
  pageCount: number | null
  language: string | null
  format: EditionFormat
  editionNote: string | null
  medium: "physical" | "digital"
  quantity: number
  location: string | null
  condition: string | null
  acquiredDate: Date | null
  purchasePriceCents: number | null
  readingStatus: "unread" | "reading" | "read"
  rating: number | null
  currentPage: number | null
  tags: string[]
  notes: string | null
  isWishlist: boolean
  /** 1-based line in the source file, for error messages. */
  sourceLine: number
}

export type ParsedCsv = {
  dialect: "librero" | "goodreads"
  rows: ImportRow[]
  /** Rows that could not be read at all, with the reason. */
  problems: { line: number; reason: string }[]
}

const FORMAT_ALIASES: Record<string, EditionFormat> = {
  hardcover: "hardcover",
  hardback: "hardcover",
  paperback: "paperback",
  softcover: "paperback",
  "mass market paperback": "mass_market",
  mass_market: "mass_market",
  ebook: "ebook",
  kindle: "ebook",
  "kindle edition": "ebook",
  epub: "ebook",
  audiobook: "audiobook",
  audio: "audiobook",
  audio_cd: "audiobook",
  "audio cd": "audiobook",
  audible: "audiobook",
}

function toFormat(value: string | undefined): EditionFormat {
  if (!value) return "paperback"
  return FORMAT_ALIASES[value.trim().toLowerCase()] ?? "other"
}

function text(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function int(value: string | undefined): number | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function date(value: string | undefined): Date | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function priceCents(value: string | undefined): number | null {
  const trimmed = value?.trim().replace(/[^0-9.]/g, "")
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null
}

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Goodreads wraps ISBNs as ="9780441013593" to stop Excel mangling them. */
function goodreadsIsbn(value: string | undefined): string | null {
  const cleaned = value?.replace(/[="\s]/g, "")
  return cleaned && cleaned.length > 0 ? cleaned : null
}

function goodreadsStatus(shelf: string | undefined): "unread" | "reading" | "read" {
  const value = shelf?.trim().toLowerCase()
  if (value === "read") return "read"
  if (value === "currently-reading") return "reading"
  return "unread"
}

function normalizeIsbnPair(isbn13: string | null, isbn10: string | null) {
  const parsed = parseIsbn(isbn13 ?? isbn10 ?? "")
  if (parsed) return parsed
  // Keep an unparseable value rather than dropping it: it is still a useful
  // note on the row, it just will not be used for matching.
  return { isbn13, isbn10 }
}

function fromLibreroRow(row: Record<string, string>, line: number): ImportRow {
  const isbns = normalizeIsbnPair(text(row.isbn13), text(row.isbn10))
  return {
    title: row.title?.trim() ?? "",
    subtitle: text(row.subtitle),
    authors: splitList(row.authors),
    series: text(row.series),
    seriesPosition: row.series_position ? Number(row.series_position) : null,
    firstPublishYear: int(row.first_publish_year),
    isbn13: isbns.isbn13,
    isbn10: isbns.isbn10,
    publisher: text(row.publisher),
    publishYear: int(row.publish_year),
    pageCount: int(row.page_count),
    language: text(row.language),
    format: toFormat(row.format),
    editionNote: text(row.edition_note),
    medium: row.medium?.trim().toLowerCase() === "digital" ? "digital" : "physical",
    quantity: Math.max(1, int(row.quantity) ?? 1),
    location: text(row.location),
    condition: text(row.condition),
    acquiredDate: date(row.acquired_date),
    purchasePriceCents: priceCents(row.purchase_price),
    readingStatus:
      row.reading_status === "read" || row.reading_status === "reading"
        ? row.reading_status
        : "unread",
    rating: int(row.rating),
    currentPage: int(row.current_page),
    tags: splitList(row.tags),
    notes: text(row.notes),
    isWishlist: ["1", "true", "yes"].includes(row.wishlist?.trim().toLowerCase() ?? ""),
    sourceLine: line,
  }
}

function fromGoodreadsRow(row: Record<string, string>, line: number): ImportRow {
  const isbns = normalizeIsbnPair(
    goodreadsIsbn(row["ISBN13"]),
    goodreadsIsbn(row["ISBN"])
  )
  const authors = [row["Author"], row["Additional Authors"]]
    .flatMap((value) => splitList(value))
    .filter(Boolean)

  const rating = int(row["My Rating"])

  return {
    title: row["Title"]?.trim() ?? "",
    subtitle: null,
    authors,
    series: null,
    seriesPosition: null,
    firstPublishYear: int(row["Original Publication Year"]),
    isbn13: isbns.isbn13,
    isbn10: isbns.isbn10,
    publisher: text(row["Publisher"]),
    publishYear: int(row["Year Published"]),
    pageCount: int(row["Number of Pages"]),
    language: null,
    format: toFormat(row["Binding"]),
    editionNote: null,
    medium: "physical",
    quantity: 1,
    location: null,
    condition: null,
    acquiredDate: date(row["Date Added"]),
    purchasePriceCents: null,
    readingStatus: goodreadsStatus(row["Exclusive Shelf"]),
    // Goodreads writes 0 for "unrated".
    rating: rating && rating > 0 ? rating : null,
    // Goodreads exports no reading position, so progress stays untracked.
    currentPage: null,
    tags: splitList(row["Bookshelves"]).filter(
      (shelf) => !["read", "currently-reading", "to-read"].includes(shelf)
    ),
    notes: text(row["My Review"]),
    isWishlist: row["Exclusive Shelf"]?.trim() === "to-read",
    sourceLine: line,
  }
}

export function parseCsv(content: string): ParsedCsv {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, string>[]

  const header = Object.keys(records[0] ?? {})
  // "Exclusive Shelf" is Goodreads-specific and always present in their export.
  const dialect = header.includes("Exclusive Shelf") || header.includes("Book Id")
    ? "goodreads"
    : "librero"

  const rows: ImportRow[] = []
  const problems: ParsedCsv["problems"] = []

  records.forEach((record, index) => {
    // +2: one for the header row, one because humans count from 1.
    const line = index + 2
    const row =
      dialect === "goodreads"
        ? fromGoodreadsRow(record, line)
        : fromLibreroRow(record, line)

    if (!row.title) {
      problems.push({ line, reason: "No title" })
      return
    }
    rows.push(row)
  })

  return { dialect, rows, problems }
}

/* ---------------------------------------------------------------- export */

export type ExportRow = Record<(typeof LIBRERO_COLUMNS)[number], string>

export function toCsv(rows: ExportRow[]): string {
  return stringify(rows, { header: true, columns: [...LIBRERO_COLUMNS] })
}
