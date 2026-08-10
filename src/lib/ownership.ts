import "server-only"

import { sqlite } from "@/db"
import type { EditionFormat } from "@/db/schema"
import { parseIsbn } from "@/lib/isbn"
import { toAuthorMatchKey, toTitleMatchKey } from "@/lib/text"

/**
 * The answer to "am I about to buy this twice?".
 *
 * The distinction between the two OWNED verdicts is the whole point of the
 * work/edition split: OWNED_SAME_EDITION means put it back, OWNED_OTHER_EDITION
 * means it is a judgement call — you may well want the hardcover.
 */
export type OwnershipVerdict =
  | "OWNED_SAME_EDITION"
  | "OWNED_OTHER_EDITION"
  | "ON_WISHLIST"
  | "NOT_OWNED"

export type OwnedEditionSummary = {
  editionId: number
  format: EditionFormat
  publisher: string | null
  publishYear: number | null
  isbn13: string | null
  editionNote: string | null
  /** Total copies of this edition, summing quantities. */
  copyCount: number
  locations: string[]
  /** True when this is the exact edition that was scanned. */
  isMatch: boolean
}

export type OwnershipCheck = {
  verdict: OwnershipVerdict
  workId: number | null
  workTitle: string | null
  authors: string | null
  /** Every edition of the matched work that you actually own a copy of. */
  ownedEditions: OwnedEditionSummary[]
  totalCopies: number
}

const NOT_OWNED: OwnershipCheck = {
  verdict: "NOT_OWNED",
  workId: null,
  workTitle: null,
  authors: null,
  ownedEditions: [],
  totalCopies: 0,
}

export type OwnershipCandidate = {
  isbn?: string | null
  title?: string | null
  primaryAuthor?: string | null
  openLibraryWorkId?: string | null
}

type EditionRow = {
  editionId: number
  format: EditionFormat
  publisher: string | null
  publishYear: number | null
  isbn13: string | null
  editionNote: string | null
  copyCount: number
  locations: string | null
}

function ownedEditionsOf(workId: number, matchedEditionId: number | null): OwnedEditionSummary[] {
  const rows = sqlite
    .prepare(
      `SELECT e.id            AS editionId,
              e.format        AS format,
              e.publisher     AS publisher,
              e.publish_year  AS publishYear,
              e.isbn13        AS isbn13,
              e.edition_note  AS editionNote,
              sum(c.quantity) AS copyCount,
              group_concat(DISTINCT c.location) AS locations
         FROM editions e
         JOIN copies c ON c.edition_id = e.id
        WHERE e.work_id = ?
        GROUP BY e.id
        ORDER BY e.publish_year, e.id`
    )
    .all(workId) as EditionRow[]

  return rows.map((row) => ({
    editionId: row.editionId,
    format: row.format,
    publisher: row.publisher,
    publishYear: row.publishYear,
    isbn13: row.isbn13,
    editionNote: row.editionNote,
    copyCount: row.copyCount,
    locations: row.locations ? row.locations.split(",").filter(Boolean) : [],
    isMatch: row.editionId === matchedEditionId,
  }))
}

function describeWork(workId: number) {
  return sqlite
    .prepare(
      `SELECT w.title AS title,
              w.is_wishlist AS isWishlist,
              COALESCE((SELECT group_concat(a.name, ', ')
                          FROM work_authors wa JOIN authors a ON a.id = wa.author_id
                         WHERE wa.work_id = w.id AND wa.role = 'author'), '') AS authors
         FROM works w WHERE w.id = ?`
    )
    .get(workId) as { title: string; isWishlist: number; authors: string } | undefined
}

function verdictFor(workId: number, matchedEditionId: number | null): OwnershipCheck {
  const work = describeWork(workId)
  if (!work) return NOT_OWNED

  const ownedEditions = ownedEditionsOf(workId, matchedEditionId)
  const totalCopies = ownedEditions.reduce((sum, edition) => sum + edition.copyCount, 0)

  let verdict: OwnershipVerdict
  if (ownedEditions.some((edition) => edition.isMatch)) {
    verdict = "OWNED_SAME_EDITION"
  } else if (ownedEditions.length > 0) {
    verdict = "OWNED_OTHER_EDITION"
  } else if (work.isWishlist) {
    verdict = "ON_WISHLIST"
  } else {
    // A work row with no copies and no wishlist flag — an edition was recorded
    // but never owned. Treat it as not owned, but keep the link to the work.
    verdict = "NOT_OWNED"
  }

  return {
    verdict,
    workId,
    workTitle: work.title,
    authors: work.authors || null,
    ownedEditions,
    totalCopies,
  }
}

/**
 * Decide whether a candidate book is already on the shelf.
 *
 * Checks run strongest-signal-first and stop at the first hit:
 *   1. exact ISBN-13/10 on an edition   -> we know the printing
 *   2. Open Library work id             -> same book, provider-confirmed
 *   3. normalized title + author surname -> same book, best effort
 */
export function checkOwnership(candidate: OwnershipCandidate): OwnershipCheck {
  const isbn = candidate.isbn ? parseIsbn(candidate.isbn) : null

  if (isbn) {
    const row = sqlite
      .prepare(
        `SELECT id AS editionId, work_id AS workId FROM editions
          WHERE (isbn13 IS NOT NULL AND isbn13 = ?)
             OR (isbn10 IS NOT NULL AND isbn10 = ?)
          LIMIT 1`
      )
      .get(isbn.isbn13 ?? "", isbn.isbn10 ?? "") as
      | { editionId: number; workId: number }
      | undefined

    if (row) return verdictFor(row.workId, row.editionId)
  }

  if (candidate.openLibraryWorkId) {
    const row = sqlite
      .prepare("SELECT id FROM works WHERE open_library_work_id = ?")
      .get(candidate.openLibraryWorkId) as { id: number } | undefined
    if (row) return verdictFor(row.id, null)
  }

  if (candidate.title && candidate.primaryAuthor) {
    const row = sqlite
      .prepare(
        `SELECT w.id FROM works w
           JOIN work_authors wa ON wa.work_id = w.id AND wa.role = 'author'
           JOIN authors a ON a.id = wa.author_id
          WHERE w.match_key = ? AND a.match_key = ?
          LIMIT 1`
      )
      .get(
        toTitleMatchKey(candidate.title),
        toAuthorMatchKey(candidate.primaryAuthor)
      ) as { id: number } | undefined

    if (row) return verdictFor(row.id, null)
  }

  return NOT_OWNED
}
