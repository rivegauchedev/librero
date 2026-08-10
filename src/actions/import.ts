"use server"

import { revalidatePath } from "next/cache"

import { applyImport, previewImport } from "@/db/mutations/import"
import { assertUser, AuthorizationError } from "@/lib/auth"
import { parseCsv, type ImportRow } from "@/lib/csv"

const MAX_CSV_BYTES = 10 * 1024 * 1024

export type ImportState = {
  error?: string
  success?: string
  preview?: {
    dialect: "librero" | "goodreads"
    counts: { new: number; newEdition: number; duplicate: number; skipped: number }
    problems: { line: number; reason: string }[]
    /** A handful of rows to eyeball before committing. */
    sample: { title: string; authors: string; isbn13: string | null; outcome: string }[]
    /** The parsed rows, handed back so the confirm step does not re-upload. */
    rows: ImportRow[]
  }
}

async function readCsv(formData: FormData): Promise<string | { error: string }> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file." }
  }
  if (file.size > MAX_CSV_BYTES) {
    return { error: "That file is larger than 10 MB." }
  }
  return file.text()
}

export async function previewCsvImport(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  try {
    await assertUser()

    const content = await readCsv(formData)
    if (typeof content !== "string") return content

    const parsed = parseCsv(content)
    if (parsed.rows.length === 0) {
      return { error: "No usable rows found in that file." }
    }

    const preview = previewImport(parsed.rows)

    return {
      preview: {
        dialect: parsed.dialect,
        counts: preview.counts,
        problems: parsed.problems.slice(0, 20),
        sample: preview.outcomes.slice(0, 15).map((outcome) => ({
          title: outcome.row.title,
          authors: outcome.row.authors.join(", "),
          isbn13: outcome.row.isbn13,
          outcome: outcome.kind,
        })),
        rows: parsed.rows,
      },
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    console.error("CSV preview failed:", error)
    return { error: "That file could not be read as CSV." }
  }
}

export async function confirmCsvImport(
  rows: ImportRow[],
  skipDuplicates: boolean
): Promise<ImportState> {
  try {
    await assertUser()

    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: "Nothing to import." }
    }

    // Dates survive the round trip to the client as strings.
    const normalized = rows.map((row) => ({
      ...row,
      acquiredDate: row.acquiredDate ? new Date(row.acquiredDate) : null,
    }))

    const outcome = applyImport(normalized, { skipDuplicates })

    revalidatePath("/")
    revalidatePath("/library")
    revalidatePath("/wishlist")

    return {
      success:
        `Imported ${outcome.worksCreated} new ${outcome.worksCreated === 1 ? "book" : "books"}, ` +
        `${outcome.editionsCreated} ${outcome.editionsCreated === 1 ? "edition" : "editions"} ` +
        `and ${outcome.copiesCreated} ${outcome.copiesCreated === 1 ? "copy" : "copies"}` +
        (outcome.skipped > 0 ? `; skipped ${outcome.skipped}.` : "."),
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    console.error("CSV import failed:", error)
    return { error: "The import failed and nothing was changed." }
  }
}
