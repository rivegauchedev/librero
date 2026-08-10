import { z } from "zod"

/*
 * Zod pieces shared by every Server Action that parses a FormData.
 *
 * FormData.get() returns null for a field the form did not render, and
 * Object.fromEntries omits it entirely — so every optional field has to accept
 * null and undefined as well as the empty string, and normalize all three to
 * null.
 *
 * These live here rather than beside the actions because a "use server" module
 * may only export async functions.
 */

export const optionalInt = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim()
    if (!trimmed) return null
    const parsed = Number.parseInt(trimmed, 10)
    return Number.isFinite(parsed) ? parsed : null
  })

export const optionalText = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  })

/** A comma-separated field that may be missing entirely. */
export const optionalList = z
  .string()
  .nullish()
  .transform((value) =>
    (value ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  )

/** An `<input type="date">`: empty means "not recorded". */
export const optionalDate = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed ? new Date(trimmed) : null
  })
  .pipe(z.date().nullable())
