"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createLoan, deleteLoan, returnLoan } from "@/db/mutations/loans"
import { assertUser, AuthorizationError } from "@/lib/auth"
import { optionalDate, optionalText } from "@/lib/form-fields"

export type LoanActionState = {
  error?: string
  success?: string
  workId?: number
}

function fail(error: unknown): LoanActionState {
  if (error instanceof AuthorizationError) return { error: error.message }
  // The only unique constraint on loans is one open loan per copy.
  if (error instanceof Error && error.message.includes("UNIQUE")) {
    return { error: "That copy is already lent out — mark it returned first." }
  }
  console.error("Loan action failed:", error)
  return { error: "Something went wrong. Please try again." }
}

/*
 * A loan shows up on the book's page and on /loans, and can be changed from
 * either, so both are always revalidated. Every form carries a workId for that
 * reason — the /loans rows would otherwise have no work in scope.
 */
function refreshLoans(workId?: number) {
  revalidatePath("/loans")
  if (workId) revalidatePath(`/works/${workId}`)
}

const workIdField = z.coerce.number().int().positive().optional()

const lendSchema = z.object({
  copyId: z.coerce.number().int().positive(),
  workId: workIdField,
  borrowerName: z.string().trim().min(1, "Who has it?").max(120),
  borrowedAt: optionalDate,
  notes: optionalText,
})

export async function lendCopy(
  _prev: LoanActionState,
  formData: FormData
): Promise<LoanActionState> {
  try {
    await assertUser()

    const parsed = lendSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const input = parsed.data

    createLoan({
      copyId: input.copyId,
      borrowerName: input.borrowerName,
      borrowedAt: input.borrowedAt,
      notes: input.notes,
    })

    refreshLoans(input.workId)
    return { workId: input.workId, success: `Lent to ${input.borrowerName}.` }
  } catch (error) {
    return fail(error)
  }
}

const loanSchema = z.object({
  loanId: z.coerce.number().int().positive(),
  workId: workIdField,
})

export async function markLoanReturned(
  _prev: LoanActionState,
  formData: FormData
): Promise<LoanActionState> {
  try {
    await assertUser()

    const parsed = loanSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const { loanId, workId } = parsed.data

    if (returnLoan(loanId) === 0) {
      return { workId, error: "That loan is already closed." }
    }

    refreshLoans(workId)
    return { workId, success: "Marked returned." }
  } catch (error) {
    return fail(error)
  }
}

/** For a loan entered by mistake — returned loans are kept as history. */
export async function removeLoan(
  _prev: LoanActionState,
  formData: FormData
): Promise<LoanActionState> {
  try {
    await assertUser()

    const parsed = loanSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const { loanId, workId } = parsed.data

    deleteLoan(loanId)

    refreshLoans(workId)
    return { workId, success: "Loan removed." }
  } catch (error) {
    return fail(error)
  }
}
