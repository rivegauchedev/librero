import "server-only"

import { sqlite } from "@/db"
import type { CopyMedium, EditionFormat, LoanStatus } from "@/db/schema"

/*
 * A loan's status is not a column — it is `returned_at IS NULL`. Every query
 * here projects it back out so the rest of the app can speak in "pending" and
 * "returned" without knowing that.
 */
const STATUS_SQL = `CASE WHEN l.returned_at IS NULL THEN 'pending' ELSE 'returned' END`

/** One loan as it appears under a copy on the work page. */
export type CopyLoan = {
  id: number
  copyId: number
  borrowerName: string
  borrowedAt: number
  returnedAt: number | null
  notes: string | null
  status: LoanStatus
}

/** One row of the /loans list: a loan flattened with the book it belongs to. */
export type LoanListRow = {
  id: number
  borrowerName: string
  borrowedAt: number
  returnedAt: number | null
  notes: string | null
  status: LoanStatus
  copyId: number
  workId: number
  title: string
  subtitle: string | null
  authors: string
  coverPath: string | null
  format: EditionFormat
  medium: CopyMedium
  location: string | null
}

const LOAN_LIST_SQL = `
  SELECT
    l.id                                       AS id,
    l.borrower_name                            AS borrowerName,
    l.borrowed_at                              AS borrowedAt,
    l.returned_at                              AS returnedAt,
    l.notes                                    AS notes,
    ${STATUS_SQL}                              AS status,
    c.id                                       AS copyId,
    w.id                                       AS workId,
    w.title                                    AS title,
    w.subtitle                                 AS subtitle,
    COALESCE((SELECT group_concat(a.name, ', ')
                FROM work_authors wa
                JOIN authors a ON a.id = wa.author_id
               WHERE wa.work_id = w.id AND wa.role = 'author'
               ORDER BY wa.position), '')      AS authors,
    e.cover_path                               AS coverPath,
    e.format                                   AS format,
    c.medium                                   AS medium,
    c.location                                 AS location
  FROM loans l
  JOIN copies c   ON c.id = l.copy_id
  JOIN editions e ON e.id = c.edition_id
  JOIN works w    ON w.id = e.work_id
`

/** Everything still out, longest-out first — that is the useful order. */
export function listOpenLoans(): LoanListRow[] {
  return sqlite
    .prepare(`${LOAN_LIST_SQL} WHERE l.returned_at IS NULL ORDER BY l.borrowed_at, l.id`)
    .all() as LoanListRow[]
}

export function listRecentlyReturned(limit = 10): LoanListRow[] {
  return sqlite
    .prepare(
      `${LOAN_LIST_SQL} WHERE l.returned_at IS NOT NULL
        ORDER BY l.returned_at DESC, l.id DESC LIMIT ?`
    )
    .all(limit) as LoanListRow[]
}

/** Every loan ever recorded against any copy of a work, newest first. */
export function listLoansForWork(workId: number): CopyLoan[] {
  return sqlite
    .prepare(
      `SELECT l.id, l.copy_id AS copyId, l.borrower_name AS borrowerName,
              l.borrowed_at AS borrowedAt, l.returned_at AS returnedAt, l.notes,
              ${STATUS_SQL} AS status
         FROM loans l
         JOIN copies c   ON c.id = l.copy_id
         JOIN editions e ON e.id = c.edition_id
        WHERE e.work_id = ?
        ORDER BY l.borrowed_at DESC, l.id DESC`
    )
    .all(workId) as CopyLoan[]
}

/** Guards deleting a copy that is currently in someone else's hands. */
export function countOpenLoansForCopy(copyId: number): number {
  const row = sqlite
    .prepare(`SELECT count(*) AS count FROM loans WHERE copy_id = ? AND returned_at IS NULL`)
    .get(copyId) as { count: number }
  return row.count
}

export function countOpenLoans(): number {
  const row = sqlite
    .prepare(`SELECT count(*) AS count FROM loans WHERE returned_at IS NULL`)
    .get() as { count: number }
  return row.count
}
