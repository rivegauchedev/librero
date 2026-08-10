"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { sqlite } from "@/db"
import {
  createCopy,
  createEdition,
  deleteCopy,
  deleteEdition,
  deleteWork,
  importBook,
  isCoverReferenced,
  setEditionCover,
  updateCopy,
  updateEdition,
  updateWork,
} from "@/db/mutations/catalog"
import { countOpenLoansForCopy } from "@/db/queries/loans"
import { EDITION_FORMATS, FILE_FORMATS, READING_STATUSES } from "@/db/schema"
import { assertUser, AuthorizationError } from "@/lib/auth"
import {
  cacheCover,
  cacheCoverFromUserUrl,
  CoverError,
  deleteCoverIfUnused,
} from "@/lib/covers"
import { optionalInt, optionalList, optionalText } from "@/lib/form-fields"
import { lookupByIsbn } from "@/lib/providers"
import { deleteCopyFiles } from "@/lib/uploads"

/**
 * Copies are removed by SQL cascade, which cannot touch the disk. Collect the
 * ids first so their uploaded ebooks can be unlinked afterwards — otherwise the
 * uploads directory grows forever with files nothing references.
 */
function copyIdsUnderWork(workId: number): number[] {
  return (
    sqlite
      .prepare(
        `SELECT c.id FROM copies c
           JOIN editions e ON e.id = c.edition_id
          WHERE e.work_id = ?`
      )
      .all(workId) as { id: number }[]
  ).map((row) => row.id)
}

function copyIdsUnderEdition(editionId: number): number[] {
  return (
    sqlite.prepare("SELECT id FROM copies WHERE edition_id = ?").all(editionId) as {
      id: number
    }[]
  ).map((row) => row.id)
}

export type BookActionState = {
  error?: string
  success?: string
  workId?: number
}

function fail(error: unknown): BookActionState {
  if (error instanceof AuthorizationError) return { error: error.message }
  // A cover error names something the user can act on: a bad link, an oversized
  // image, a host we will not fetch from.
  if (error instanceof CoverError) return { error: error.message }
  if (error instanceof Error && error.message.includes("UNIQUE")) {
    return { error: "That ISBN is already recorded on another edition." }
  }
  console.error("Book action failed:", error)
  return { error: "Something went wrong. Please try again." }
}

function refresh(workId?: number) {
  revalidatePath("/")
  revalidatePath("/library")
  revalidatePath("/wishlist")
  if (workId) revalidatePath(`/works/${workId}`)
}

/* --------------------------------------------- add a book from a provider */

const addFromProviderSchema = z.object({
  isbn: z.string().trim().min(1, "An ISBN is required"),
  intent: z.enum(["own", "wishlist"]),
  format: z.enum(EDITION_FORMATS).optional(),
  medium: z.enum(["physical", "digital"]).default("physical"),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  location: optionalText,
})

/**
 * The one-tap path off the bookstore screen: fetch metadata, cache the cover,
 * create work + edition, and (unless it is a wishlist entry) a copy.
 */
export async function addBookByIsbn(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()

    const parsed = addFromProviderSchema.safeParse({
      isbn: formData.get("isbn"),
      intent: formData.get("intent"),
      format: formData.get("format") || undefined,
      medium: formData.get("medium") ?? "physical",
      quantity: formData.get("quantity") ?? 1,
      location: formData.get("location") ?? "",
    })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }

    const book = await lookupByIsbn(parsed.data.isbn)
    if (!book) {
      return { error: "No book found for that ISBN. You can still add it by hand." }
    }

    // Fetched outside the transaction: network work must never hold a write lock.
    const coverPath = book.coverUrl ? await cacheCover(book.coverUrl) : null

    const result = importBook(book, {
      coverPath,
      asWishlist: parsed.data.intent === "wishlist",
      format: parsed.data.format,
    })

    if (parsed.data.intent === "own") {
      createCopy({
        editionId: result.editionId,
        medium: parsed.data.medium,
        quantity: parsed.data.quantity,
        location: parsed.data.location,
      })
    }

    refresh(result.workId)
    return {
      workId: result.workId,
      success:
        parsed.data.intent === "wishlist"
          ? `Added ${book.title} to your wishlist.`
          : `Added ${book.title} to your library.`,
    }
  } catch (error) {
    return fail(error)
  }
}

/* ------------------------------------------------------ manual book entry */

const manualBookSchema = z.object({
  title: z.string().trim().min(1, "A title is required"),
  authors: optionalList,
  subtitle: optionalText,
  firstPublishYear: optionalInt,
  isbn13: optionalText,
  publisher: optionalText,
  publishYear: optionalInt,
  pageCount: optionalInt,
  format: z.enum(EDITION_FORMATS),
  editionNote: optionalText,
  intent: z.enum(["own", "wishlist"]),
  medium: z.enum(["physical", "digital"]).default("physical"),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  location: optionalText,
})

export async function addBookManually(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()

    const parsed = manualBookSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const input = parsed.data

    const result = importBook(
      {
        title: input.title,
        subtitle: input.subtitle,
        authors: input.authors,
        description: null,
        firstPublishYear: input.firstPublishYear,
        subjects: [],
        series: null,
        isbn13: input.isbn13,
        isbn10: null,
        publisher: input.publisher,
        publishYear: input.publishYear,
        pageCount: input.pageCount,
        language: null,
        format: input.format,
        coverUrl: null,
        openLibraryWorkId: null,
        openLibraryEditionId: null,
        source: "manual",
      },
      { asWishlist: input.intent === "wishlist", format: input.format }
    )

    if (input.editionNote) {
      sqlite
        .prepare("UPDATE editions SET edition_note = ? WHERE id = ?")
        .run(input.editionNote, result.editionId)
    }

    if (input.intent === "own") {
      createCopy({
        editionId: result.editionId,
        medium: input.medium,
        quantity: input.quantity,
        location: input.location,
      })
    }

    refresh(result.workId)
    return { workId: result.workId, success: `Added ${input.title}.` }
  } catch (error) {
    return fail(error)
  }
}

/* ------------------------------------------------------------------ works */

const updateWorkSchema = z.object({
  workId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, "A title is required"),
  subtitle: optionalText,
  authors: optionalList,
  description: optionalText,
  firstPublishYear: optionalInt,
  tags: optionalList,
  seriesName: optionalText,
  seriesPosition: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(z.number().nullable()),
})

export async function saveWork(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()

    const parsed = updateWorkSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const input = parsed.data

    updateWork(input.workId, {
      title: input.title,
      subtitle: input.subtitle,
      description: input.description,
      firstPublishYear: input.firstPublishYear,
      authors: input.authors,
      tags: input.tags,
      series: input.seriesName
        ? { name: input.seriesName, position: input.seriesPosition }
        : null,
    })

    refresh(input.workId)
    return { workId: input.workId, success: "Saved." }
  } catch (error) {
    return fail(error)
  }
}

const readingStatusSchema = z.object({
  workId: z.coerce.number().int().positive(),
  readingStatus: z.enum(READING_STATUSES),
  rating: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === "0" ? null : Number(value)))
    .pipe(z.number().int().min(1).max(5).nullable()),
  notes: optionalText,
})

export async function saveReadingProgress(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()

    const parsed = readingStatusSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const input = parsed.data

    sqlite
      .prepare(
        `UPDATE works SET
           reading_status = ?, rating = ?, notes = ?,
           date_finished = CASE WHEN ? = 'read' AND date_finished IS NULL
                                THEN unixepoch() ELSE date_finished END,
           updated_at = unixepoch()
         WHERE id = ?`
      )
      .run(
        input.readingStatus,
        input.rating,
        input.notes,
        input.readingStatus,
        input.workId
      )

    refresh(input.workId)
    return { workId: input.workId, success: "Saved." }
  } catch (error) {
    return fail(error)
  }
}

export async function toggleWishlist(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()
    const workId = Number(formData.get("workId"))
    if (!Number.isInteger(workId) || workId <= 0) return { error: "Invalid book." }

    const row = sqlite
      .prepare(
        `SELECT is_wishlist AS isWishlist,
                (SELECT count(*) FROM editions e JOIN copies c ON c.edition_id = e.id
                  WHERE e.work_id = works.id) AS copyRows
           FROM works WHERE id = ?`
      )
      .get(workId) as { isWishlist: number; copyRows: number } | undefined

    if (!row) return { error: "That book no longer exists." }
    if (!row.isWishlist && row.copyRows > 0) {
      return { error: "Remove its copies before moving it to the wishlist." }
    }

    sqlite
      .prepare("UPDATE works SET is_wishlist = ?, updated_at = unixepoch() WHERE id = ?")
      .run(row.isWishlist ? 0 : 1, workId)

    refresh(workId)
    return {
      workId,
      success: row.isWishlist ? "Moved to your library." : "Moved to your wishlist.",
    }
  } catch (error) {
    return fail(error)
  }
}

export async function removeWork(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()
    const workId = Number(formData.get("workId"))
    if (!Number.isInteger(workId) || workId <= 0) return { error: "Invalid book." }

    const copyIds = copyIdsUnderWork(workId)
    deleteWork(workId)
    await Promise.all(copyIds.map(deleteCopyFiles))

    refresh()
    return { success: "Removed from your library." }
  } catch (error) {
    return fail(error)
  }
}

/* --------------------------------------------------------------- editions */

const editionSchema = z.object({
  workId: z.coerce.number().int().positive(),
  isbn13: optionalText,
  isbn10: optionalText,
  publisher: optionalText,
  publishYear: optionalInt,
  pageCount: optionalInt,
  language: optionalText,
  format: z.enum(EDITION_FORMATS),
  editionNote: optionalText,
})

export async function addEdition(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()

    const parsed = editionSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }

    createEdition({ ...parsed.data, title: null, metadataSource: "manual" })
    refresh(parsed.data.workId)
    return { workId: parsed.data.workId, success: "Edition added." }
  } catch (error) {
    return fail(error)
  }
}

export async function saveEdition(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()

    const parsed = editionSchema
      .extend({
        editionId: z.coerce.number().int().positive(),
        coverUrl: optionalText,
      })
      .safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const { editionId, workId, coverUrl, ...rest } = parsed.data

    // Download before touching the database: a bad URL should leave the edition
    // exactly as it was, with an error the user can act on.
    let cover: { path: string; source: string } | null = null
    if (coverUrl) {
      const existing = sqlite
        .prepare("SELECT cover_source_url AS source FROM editions WHERE id = ?")
        .get(editionId) as { source: string | null } | undefined

      // Re-downloading an unchanged URL would be wasted work.
      if (existing?.source !== coverUrl) {
        cover = { path: await cacheCoverFromUserUrl(coverUrl), source: coverUrl }
      }
    }

    updateEdition(editionId, { ...rest, title: null })

    if (cover) {
      const displaced = setEditionCover(editionId, cover.path, cover.source)
      if (displaced) await deleteCoverIfUnused(displaced, isCoverReferenced)
    }

    refresh(workId)
    return { workId, success: cover ? "Edition and cover saved." : "Edition saved." }
  } catch (error) {
    return fail(error)
  }
}

/** Drop an edition's cover, deleting the cached file if nothing else uses it. */
export async function removeEditionCover(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()

    const editionId = Number(formData.get("editionId"))
    const workId = Number(formData.get("workId"))
    if (!Number.isInteger(editionId) || editionId <= 0) {
      return { error: "Invalid edition." }
    }

    const displaced = setEditionCover(editionId, null, null)
    if (displaced) await deleteCoverIfUnused(displaced, isCoverReferenced)

    refresh(workId)
    return { workId, success: "Cover removed." }
  } catch (error) {
    return fail(error)
  }
}

export async function removeEdition(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()
    const editionId = Number(formData.get("editionId"))
    const workId = Number(formData.get("workId"))
    if (!Number.isInteger(editionId)) return { error: "Invalid edition." }

    const copyIds = copyIdsUnderEdition(editionId)
    deleteEdition(editionId)
    await Promise.all(copyIds.map(deleteCopyFiles))

    refresh(workId)
    return { workId, success: "Edition removed." }
  } catch (error) {
    return fail(error)
  }
}

/* ----------------------------------------------------------------- copies */

const copySchema = z.object({
  workId: z.coerce.number().int().positive(),
  editionId: z.coerce.number().int().positive(),
  medium: z.enum(["physical", "digital"]),
  quantity: z.coerce.number().int().min(1).max(999),
  condition: optionalText,
  location: optionalText,
  notes: optionalText,
  externalService: optionalText,
  fileFormat: z.enum(FILE_FORMATS).optional(),
  acquiredDate: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : new Date(value)))
    .pipe(z.date().nullable()),
  purchasePrice: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Math.round(Number(value) * 100)))
    .pipe(z.number().int().nullable()),
})

export async function addCopy(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()

    const parsed = copySchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const { workId, purchasePrice, ...rest } = parsed.data

    createCopy({ ...rest, purchasePriceCents: purchasePrice })
    refresh(workId)
    return { workId, success: "Copy added." }
  } catch (error) {
    return fail(error)
  }
}

export async function saveCopy(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()

    const parsed = copySchema
      .extend({ copyId: z.coerce.number().int().positive() })
      .safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const { copyId, workId, purchasePrice, ...rest } = parsed.data

    updateCopy(copyId, { ...rest, purchasePriceCents: purchasePrice })
    refresh(workId)
    return { workId, success: "Copy saved." }
  } catch (error) {
    return fail(error)
  }
}

export async function removeCopy(
  _prev: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  try {
    await assertUser()
    const copyId = Number(formData.get("copyId"))
    const workId = Number(formData.get("workId"))
    if (!Number.isInteger(copyId)) return { error: "Invalid copy." }

    // Deleting the copy cascades its loan history away, so refuse while the
    // book is still in someone else's hands.
    if (countOpenLoansForCopy(copyId) > 0) {
      return { error: "That copy is lent out. Mark it returned before removing it." }
    }

    deleteCopy(copyId)
    await deleteCopyFiles(copyId)

    refresh(workId)
    return { workId, success: "Copy removed." }
  } catch (error) {
    return fail(error)
  }
}
