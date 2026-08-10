import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createTempDatabase } from "./helpers/temp-db"

// The temp database must exist before "@/db" is imported, because that module
// opens the connection at evaluation time.
const temp = createTempDatabase()

const { sqlite } = await import("@/db")
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator")
const { drizzle } = await import("drizzle-orm/better-sqlite3")

const { createWork, createEdition, createCopy, deleteCopy } = await import(
  "@/db/mutations/catalog"
)
const { createLoan, returnLoan, deleteLoan } = await import("@/db/mutations/loans")
const { listOpenLoans, listRecentlyReturned, countOpenLoansForCopy } = await import(
  "@/db/queries/loans"
)
const { getWorkDetail } = await import("@/db/queries/works")

let workId: number
let editionId: number

/** A fresh copy per test, so one test's open loan cannot block the next. */
function newCopy(): number {
  return createCopy({ editionId, medium: "physical", quantity: 1 })
}

function loansOfCopy(copyId: number) {
  const detail = getWorkDetail(workId)
  const copy = detail?.editions
    .flatMap((edition) => edition.copies)
    .find((candidate) => candidate.id === copyId)
  return copy?.loans ?? []
}

beforeAll(() => {
  migrate(drizzle(sqlite), { migrationsFolder: "./src/db/migrations" })

  workId = createWork({ title: "Dune", authors: ["Frank Herbert"] })
  editionId = createEdition({ workId, format: "paperback" })
})

afterAll(() => {
  sqlite.close()
  temp.cleanup()
})

describe("lending a copy", () => {
  it("puts the copy on the open-loans list", () => {
    const copyId = newCopy()
    createLoan({ copyId, borrowerName: "Ana" })

    const open = listOpenLoans()
    const loan = open.find((row) => row.copyId === copyId)

    expect(loan).toBeDefined()
    expect(loan?.borrowerName).toBe("Ana")
    expect(loan?.status).toBe("pending")
    expect(loan?.returnedAt).toBeNull()
    // The list carries enough of the book to render a row without a second query.
    expect(loan?.title).toBe("Dune")
    expect(loan?.authors).toBe("Frank Herbert")
    expect(loan?.workId).toBe(workId)
  })

  it("refuses to lend the same copy twice", () => {
    const copyId = newCopy()
    createLoan({ copyId, borrowerName: "Ana" })

    expect(() => createLoan({ copyId, borrowerName: "Beto" })).toThrow(/UNIQUE/)
  })

  it("records the borrowed date it was given", () => {
    const copyId = newCopy()
    const borrowedAt = new Date("2026-08-01T00:00:00Z")
    createLoan({ copyId, borrowerName: "Ana", borrowedAt })

    const loan = listOpenLoans().find((row) => row.copyId === copyId)
    expect(loan?.borrowedAt).toBe(Math.floor(borrowedAt.getTime() / 1000))
  })
})

describe("returning a copy", () => {
  it("closes the loan but keeps it as history", () => {
    const copyId = newCopy()
    const loanId = createLoan({ copyId, borrowerName: "Ana" })

    expect(returnLoan(loanId)).toBe(1)
    expect(listOpenLoans().some((row) => row.copyId === copyId)).toBe(false)

    const [loan] = loansOfCopy(copyId)
    expect(loan.status).toBe("returned")
    expect(loan.returnedAt).toBeTypeOf("number")
    expect(listRecentlyReturned().some((row) => row.id === loanId)).toBe(true)
  })

  it("lets the copy be lent again — the index only covers open loans", () => {
    const copyId = newCopy()
    returnLoan(createLoan({ copyId, borrowerName: "Ana" }))

    expect(() => createLoan({ copyId, borrowerName: "Beto" })).not.toThrow()
    expect(loansOfCopy(copyId)).toHaveLength(2)
  })

  it("reports no change when the loan is already closed", () => {
    const copyId = newCopy()
    const loanId = createLoan({ copyId, borrowerName: "Ana" })
    returnLoan(loanId)

    expect(returnLoan(loanId)).toBe(0)
  })
})

describe("loan bookkeeping", () => {
  it("counts only the open loans of a copy", () => {
    const copyId = newCopy()
    expect(countOpenLoansForCopy(copyId)).toBe(0)

    const loanId = createLoan({ copyId, borrowerName: "Ana" })
    expect(countOpenLoansForCopy(copyId)).toBe(1)

    returnLoan(loanId)
    expect(countOpenLoansForCopy(copyId)).toBe(0)
  })

  it("drops a mistaken loan without touching the rest", () => {
    const copyId = newCopy()
    const loanId = createLoan({ copyId, borrowerName: "Typo" })

    deleteLoan(loanId)
    expect(loansOfCopy(copyId)).toHaveLength(0)
  })

  it("takes the loan history with the copy when it is deleted", () => {
    const copyId = newCopy()
    returnLoan(createLoan({ copyId, borrowerName: "Ana" }))

    deleteCopy(copyId)

    const remaining = sqlite
      .prepare("SELECT count(*) AS count FROM loans WHERE copy_id = ?")
      .get(copyId) as { count: number }
    expect(remaining.count).toBe(0)
  })
})
