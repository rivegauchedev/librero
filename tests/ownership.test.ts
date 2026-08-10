import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createTempDatabase } from "./helpers/temp-db"

// The temp database must exist before "@/db" is imported, because that module
// opens the connection at evaluation time.
const temp = createTempDatabase()

const { sqlite } = await import("@/db")
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator")
const { drizzle } = await import("drizzle-orm/better-sqlite3")

const { createWork, createEdition, createCopy, importBook } = await import(
  "@/db/mutations/catalog"
)
const { checkOwnership } = await import("@/lib/ownership")
const { searchLibrary } = await import("@/db/queries/search")
const { getLibraryStats } = await import("@/db/queries/stats")
const { reindexAll } = await import("@/db/fts")

/* Dune, in two printings — the exact case the app exists to answer. */
const DUNE_PAPERBACK_ISBN13 = "9780441013593"
const DUNE_HARDCOVER_ISBN13 = "9780441172719" // a different printing of the same work
const UNRELATED_ISBN13 = "9780547928227" // The Hobbit

let duneWorkId: number
let paperbackEditionId: number

beforeAll(() => {
  migrate(drizzle(sqlite), { migrationsFolder: "./src/db/migrations" })

  duneWorkId = createWork({
    title: "Dune",
    firstPublishYear: 1965,
    openLibraryWorkId: "OL893414W",
    authors: ["Frank Herbert"],
    series: { name: "Dune", position: 1 },
    tags: ["Science fiction"],
  })

  paperbackEditionId = createEdition({
    workId: duneWorkId,
    isbn13: DUNE_PAPERBACK_ISBN13,
    isbn10: "0441013597",
    publisher: "Ace Trade",
    publishYear: 2005,
    pageCount: 544,
    format: "paperback",
  })

  createCopy({
    editionId: paperbackEditionId,
    medium: "physical",
    quantity: 2,
    location: "Office / shelf B3",
  })

  // A hardcover printing recorded but never owned — it must not read as owned.
  createEdition({
    workId: duneWorkId,
    isbn13: DUNE_HARDCOVER_ISBN13,
    publisher: "Ace Hardcover",
    publishYear: 1990,
    format: "hardcover",
  })
})

afterAll(() => {
  sqlite.close()
  temp.cleanup()
})

describe("checkOwnership", () => {
  it("recognises the exact printing you own", () => {
    const result = checkOwnership({ isbn: DUNE_PAPERBACK_ISBN13 })

    expect(result.verdict).toBe("OWNED_SAME_EDITION")
    expect(result.workTitle).toBe("Dune")
    expect(result.authors).toBe("Frank Herbert")
    expect(result.totalCopies).toBe(2)

    const matched = result.ownedEditions.find((edition) => edition.isMatch)
    expect(matched?.format).toBe("paperback")
    expect(matched?.copyCount).toBe(2)
    expect(matched?.locations).toEqual(["Office / shelf B3"])
  })

  it("accepts the ISBN-10 form of the same edition", () => {
    expect(checkOwnership({ isbn: "0441013597" }).verdict).toBe("OWNED_SAME_EDITION")
    expect(checkOwnership({ isbn: "0-441-01359-7" }).verdict).toBe("OWNED_SAME_EDITION")
  })

  it("flags a different printing of a book you already have", () => {
    const result = checkOwnership({ isbn: DUNE_HARDCOVER_ISBN13 })

    expect(result.verdict).toBe("OWNED_OTHER_EDITION")
    // It tells you *what* you own, so hardcover-vs-paperback is a real choice.
    expect(result.ownedEditions).toHaveLength(1)
    expect(result.ownedEditions[0]!.format).toBe("paperback")
    expect(result.ownedEditions[0]!.isMatch).toBe(false)
  })

  it("matches on the Open Library work id when the ISBN is unknown", () => {
    const result = checkOwnership({
      isbn: "9781234567897",
      openLibraryWorkId: "OL893414W",
    })
    expect(result.verdict).toBe("OWNED_OTHER_EDITION")
    expect(result.workId).toBe(duneWorkId)
  })

  it("falls back to title and author surname", () => {
    const result = checkOwnership({
      title: "Dune: Special Edition",
      primaryAuthor: "Herbert, Frank",
    })
    expect(result.verdict).toBe("OWNED_OTHER_EDITION")
    expect(result.workId).toBe(duneWorkId)
  })

  it("does not match on title alone", () => {
    // A different author's book with the same title is a different book.
    expect(checkOwnership({ title: "Dune", primaryAuthor: "Someone Else" }).verdict).toBe(
      "NOT_OWNED"
    )
  })

  it("reports an unrelated book as not owned", () => {
    const result = checkOwnership({ isbn: UNRELATED_ISBN13 })
    expect(result.verdict).toBe("NOT_OWNED")
    expect(result.workId).toBeNull()
    expect(result.ownedEditions).toEqual([])
  })

  it("ignores a checksum-invalid ISBN rather than matching on it", () => {
    expect(checkOwnership({ isbn: "9780441013539" }).verdict).toBe("NOT_OWNED")
  })
})

describe("wishlist", () => {
  it("reports a wanted book as ON_WISHLIST, then clears once a copy exists", () => {
    const workId = createWork({
      title: "Children of Dune",
      authors: ["Frank Herbert"],
      isWishlist: true,
    })
    const editionId = createEdition({
      workId,
      isbn13: "9780441104024",
      format: "paperback",
    })

    expect(checkOwnership({ isbn: "9780441104024" }).verdict).toBe("ON_WISHLIST")

    createCopy({ editionId, medium: "physical", quantity: 1 })

    expect(checkOwnership({ isbn: "9780441104024" }).verdict).toBe("OWNED_SAME_EDITION")
  })
})

describe("importBook", () => {
  it("reuses the existing edition when the ISBN already exists", () => {
    const result = importBook({
      title: "Dune",
      subtitle: null,
      authors: ["Frank Herbert"],
      description: null,
      firstPublishYear: 1965,
      subjects: [],
      series: null,
      isbn13: DUNE_PAPERBACK_ISBN13,
      isbn10: "0441013597",
      publisher: "Ace Trade",
      publishYear: 2005,
      pageCount: 544,
      language: "eng",
      format: "paperback",
      coverUrl: null,
      openLibraryWorkId: "OL893414W",
      openLibraryEditionId: "OL7524304M",
      source: "openlibrary",
    })

    expect(result.reusedEdition).toBe(true)
    expect(result.workId).toBe(duneWorkId)
    expect(result.editionId).toBe(paperbackEditionId)
  })

  it("hangs a new printing off the work it already knows", () => {
    const result = importBook({
      title: "Dune",
      subtitle: null,
      authors: ["Frank Herbert"],
      description: null,
      firstPublishYear: 1965,
      subjects: [],
      series: null,
      isbn13: "9780593099322",
      isbn10: null,
      publisher: "Penguin",
      publishYear: 2019,
      pageCount: 658,
      language: "eng",
      format: "hardcover",
      coverUrl: null,
      openLibraryWorkId: "OL893414W",
      openLibraryEditionId: "OL1234567M",
      source: "openlibrary",
    })

    expect(result.reusedEdition).toBe(false)
    expect(result.workId).toBe(duneWorkId)
  })
})

describe("full-text search", () => {
  it("finds a book by title, by author and by ISBN", () => {
    expect(searchLibrary("dune").some((row) => row.id === duneWorkId)).toBe(true)
    expect(searchLibrary("herbert").some((row) => row.id === duneWorkId)).toBe(true)
    expect(searchLibrary(DUNE_PAPERBACK_ISBN13).map((row) => row.id)).toContain(duneWorkId)
  })

  it("tolerates a partial word", () => {
    expect(searchLibrary("herb").some((row) => row.id === duneWorkId)).toBe(true)
  })

  it("returns nothing for an unknown title instead of throwing", () => {
    expect(searchLibrary("zzzznotabook")).toEqual([])
    expect(searchLibrary('"')).toEqual([])
  })

  it("survives a full reindex", () => {
    const count = reindexAll()
    expect(count).toBeGreaterThan(0)
    expect(searchLibrary("dune").some((row) => row.id === duneWorkId)).toBe(true)
  })
})

describe("stats", () => {
  it("counts copies by quantity, not by row", () => {
    const stats = getLibraryStats()
    // 2 Dune paperbacks + 1 Children of Dune.
    expect(stats.copies).toBe(3)
    expect(stats.physicalCopies).toBe(3)
    expect(stats.digitalCopies).toBe(0)
    expect(stats.wishlist).toBe(0)
  })
})
