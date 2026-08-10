import "server-only"

import { sqlite } from "@/db"
import { toUnix } from "@/db/mutations/catalog"

export type LoanInput = {
  copyId: number
  borrowerName: string
  borrowedAt?: Date | null
  notes?: string | null
}

/*
 * Lending the same copy twice without a return in between violates
 * `loans_open_copy_unique`. That is left to throw on purpose: the index is the
 * only place that rule can be enforced without a race, so the action layer
 * translates the constraint error rather than pre-checking.
 */
export function createLoan(input: LoanInput): number {
  const result = sqlite
    .prepare(
      `INSERT INTO loans (copy_id, borrower_name, borrowed_at, notes)
       VALUES (?, ?, COALESCE(?, unixepoch()), ?)`
    )
    .run(input.copyId, input.borrowerName, toUnix(input.borrowedAt), input.notes ?? null)

  return Number(result.lastInsertRowid)
}

/**
 * Closes an open loan. Returns the number of rows changed, so a caller can tell
 * "marked returned" from "someone already did" without a second read.
 */
export function returnLoan(loanId: number, returnedAt?: Date | null): number {
  const result = sqlite
    .prepare(
      `UPDATE loans SET returned_at = COALESCE(?, unixepoch()), updated_at = unixepoch()
        WHERE id = ? AND returned_at IS NULL`
    )
    .run(toUnix(returnedAt), loanId)

  return result.changes
}

/** For a loan entered by mistake. Returned loans are otherwise kept as history. */
export function deleteLoan(loanId: number): void {
  sqlite.prepare("DELETE FROM loans WHERE id = ?").run(loanId)
}
