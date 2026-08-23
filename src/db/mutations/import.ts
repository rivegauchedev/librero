import "server-only"

import { sqlite } from "@/db"
import {
  createCopy,
  createEdition,
  createWork,
  findEditionByIsbn,
  findWorkByTitleAndAuthor,
} from "@/db/mutations/catalog"
import type { ImportRow } from "@/lib/csv"

export type RowOutcome =
  | { kind: "new"; row: ImportRow }
  /** The work exists; this row adds a printing to it. */
  | { kind: "new-edition"; row: ImportRow; workId: number }
  /** This exact ISBN is already recorded; the row would add another copy. */
  | { kind: "duplicate"; row: ImportRow; editionId: number }
  | { kind: "skipped"; row: ImportRow; reason: string }

export type ImportPreview = {
  outcomes: RowOutcome[]
  counts: { new: number; newEdition: number; duplicate: number; skipped: number }
}

/**
 * Work out what each row would do, without writing anything.
 *
 * A dry run matters here because a CSV import is the one operation that can
 * quietly double a whole library, and the damage is tedious to undo by hand.
 */
export function previewImport(rows: ImportRow[]): ImportPreview {
  // Rows are matched against the database *and* against earlier rows in the
  // same file, so a CSV listing the same ISBN twice reports the second as a
  // duplicate rather than silently creating two editions.
  const seenIsbns = new Set<string>()
  const seenWorks = new Map<string, number>()

  const outcomes = rows.map((row): RowOutcome => {
    if (!row.title.trim()) {
      return { kind: "skipped", row, reason: "No title" }
    }

    if (row.isbn13) {
      const existing = findEditionByIsbn(row.isbn13)
      if (existing) return { kind: "duplicate", row, editionId: existing }
      if (seenIsbns.has(row.isbn13)) {
        return { kind: "duplicate", row, editionId: -1 }
      }
      seenIsbns.add(row.isbn13)
    }

    const primaryAuthor = row.authors[0] ?? null
    const key = `${row.title.toLowerCase()}|${primaryAuthor?.toLowerCase() ?? ""}`
    const existingWork = findWorkByTitleAndAuthor(row.title, primaryAuthor) ?? seenWorks.get(key)

    if (existingWork) {
      return { kind: "new-edition", row, workId: existingWork }
    }

    // Placeholder id: the row creates a work, and later rows in this file
    // should attach to it rather than creating a second one.
    seenWorks.set(key, 0)
    return { kind: "new", row }
  })

  return {
    outcomes,
    counts: {
      new: outcomes.filter((outcome) => outcome.kind === "new").length,
      newEdition: outcomes.filter((outcome) => outcome.kind === "new-edition").length,
      duplicate: outcomes.filter((outcome) => outcome.kind === "duplicate").length,
      skipped: outcomes.filter((outcome) => outcome.kind === "skipped").length,
    },
  }
}

export type ImportOutcome = {
  worksCreated: number
  editionsCreated: number
  copiesCreated: number
  skipped: number
}

/**
 * Apply an import. Everything happens in one transaction: a CSV that fails
 * halfway through leaves no partial library behind.
 */
export function applyImport(
  rows: ImportRow[],
  options: { skipDuplicates: boolean }
): ImportOutcome {
  const run = sqlite.transaction((): ImportOutcome => {
    const outcome: ImportOutcome = {
      worksCreated: 0,
      editionsCreated: 0,
      copiesCreated: 0,
      skipped: 0,
    }

    for (const row of rows) {
      if (!row.title.trim()) {
        outcome.skipped += 1
        continue
      }

      let editionId = row.isbn13 ? findEditionByIsbn(row.isbn13) : null

      if (editionId && options.skipDuplicates) {
        outcome.skipped += 1
        continue
      }

      if (!editionId) {
        const primaryAuthor = row.authors[0] ?? null
        let workId = findWorkByTitleAndAuthor(row.title, primaryAuthor)

        if (!workId) {
          workId = createWork({
            title: row.title,
            subtitle: row.subtitle,
            firstPublishYear: row.firstPublishYear,
            authors: row.authors,
            tags: row.tags,
            series: row.series
              ? { name: row.series, position: row.seriesPosition }
              : null,
            isWishlist: row.isWishlist,
          })
          outcome.worksCreated += 1
        }

        // Reading state belongs to the work, and the CSV is the more recent
        // source of truth for a book being imported.
        sqlite
          .prepare(
            `UPDATE works SET reading_status = ?, rating = COALESCE(?, rating),
                              notes = COALESCE(?, notes),
                              current_page = COALESCE(?, current_page),
                              updated_at = unixepoch()
              WHERE id = ?`
          )
          .run(row.readingStatus, row.rating, row.notes, row.currentPage, workId)

        editionId = createEdition({
          workId,
          isbn13: row.isbn13,
          isbn10: row.isbn10,
          publisher: row.publisher,
          publishYear: row.publishYear,
          pageCount: row.pageCount,
          language: row.language,
          format: row.format,
          editionNote: row.editionNote,
          metadataSource: "manual",
        })
        outcome.editionsCreated += 1
      }

      // A wishlist row records the book but not a copy — that is the difference.
      if (!row.isWishlist) {
        createCopy({
          editionId,
          medium: row.medium,
          quantity: row.quantity,
          condition: row.condition,
          acquiredDate: row.acquiredDate,
          purchasePriceCents: row.purchasePriceCents,
          location: row.location,
        })
        outcome.copiesCreated += 1
      }
    }

    return outcome
  })

  return run()
}
