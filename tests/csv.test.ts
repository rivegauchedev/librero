import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createTempDatabase } from "./helpers/temp-db"

const temp = createTempDatabase()

const { sqlite } = await import("@/db")
const { drizzle } = await import("drizzle-orm/better-sqlite3")
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator")

const { parseCsv, toCsv } = await import("@/lib/csv")
const { exportRows } = await import("@/db/queries/export")
const { applyImport, previewImport } = await import("@/db/mutations/import")
const { getLibraryStats } = await import("@/db/queries/stats")
const { checkOwnership } = await import("@/lib/ownership")

const GOODREADS_CSV = `Book Id,Title,Author,Additional Authors,ISBN,ISBN13,My Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Exclusive Shelf,My Review
234225,Dune,Frank Herbert,"Brian Herbert","=""0441013597""","=""9780441013593""",5,Ace Trade,Mass Market Paperback,544,2005,1965,2020/03/01,2019/11/02,"sci-fi, favourites",read,Still the best.
5907,The Hobbit,J.R.R. Tolkien,,"=""054792822X""","=""9780547928227""",0,Houghton Mifflin,Paperback,366,2012,1937,,2021/01/15,fantasy,to-read,
7613,Nineteen Eighty-Four,George Orwell,,"=""""","=""""",4,Secker & Warburg,Hardcover,328,1949,1949,2018/06/01,2018/05/01,,currently-reading,
,,,,,,,,,,,,,,,,`

beforeAll(() => {
  migrate(drizzle(sqlite), { migrationsFolder: "./src/db/migrations" })
})

afterAll(() => {
  sqlite.close()
  temp.cleanup()
})

describe("parseCsv — Goodreads", () => {
  const parsed = parseCsv(GOODREADS_CSV)

  it("detects the dialect from the header", () => {
    expect(parsed.dialect).toBe("goodreads")
  })

  it("unwraps the ='...' ISBN armouring Goodreads uses for Excel", () => {
    const dune = parsed.rows.find((row) => row.title === "Dune")!
    expect(dune.isbn13).toBe("9780441013593")
    expect(dune.isbn10).toBe("0441013597")
  })

  it("maps shelves onto reading status and the wishlist", () => {
    const byTitle = Object.fromEntries(parsed.rows.map((row) => [row.title, row]))
    expect(byTitle["Dune"]!.readingStatus).toBe("read")
    expect(byTitle["Dune"]!.isWishlist).toBe(false)
    expect(byTitle["The Hobbit"]!.isWishlist).toBe(true)
    expect(byTitle["Nineteen Eighty-Four"]!.readingStatus).toBe("reading")
  })

  it("maps bindings onto our fixed format set", () => {
    const byTitle = Object.fromEntries(parsed.rows.map((row) => [row.title, row]))
    expect(byTitle["Dune"]!.format).toBe("mass_market")
    expect(byTitle["The Hobbit"]!.format).toBe("paperback")
    expect(byTitle["Nineteen Eighty-Four"]!.format).toBe("hardcover")
  })

  it("treats a Goodreads rating of 0 as unrated", () => {
    const byTitle = Object.fromEntries(parsed.rows.map((row) => [row.title, row]))
    expect(byTitle["Dune"]!.rating).toBe(5)
    expect(byTitle["The Hobbit"]!.rating).toBeNull()
  })

  it("keeps additional authors and drops the shelf pseudo-tags", () => {
    const dune = parsed.rows.find((row) => row.title === "Dune")!
    expect(dune.authors).toEqual(["Frank Herbert", "Brian Herbert"])
    expect(dune.tags).toEqual(["sci-fi", "favourites"])
  })

  it("reports the untitled row as a problem instead of importing it", () => {
    expect(parsed.rows).toHaveLength(3)
    expect(parsed.problems).toEqual([{ line: 5, reason: "No title" }])
  })
})

describe("previewImport", () => {
  it("says everything is new against an empty library", () => {
    const { counts } = previewImport(parseCsv(GOODREADS_CSV).rows)
    expect(counts).toEqual({ new: 3, newEdition: 0, duplicate: 0, skipped: 0 })
  })
})

describe("applyImport", () => {
  it("creates works, editions and copies — but no copy for a wishlist row", () => {
    const outcome = applyImport(parseCsv(GOODREADS_CSV).rows, { skipDuplicates: true })

    expect(outcome.worksCreated).toBe(3)
    expect(outcome.editionsCreated).toBe(3)
    // The Hobbit is on the to-read shelf, so it is wanted, not owned.
    expect(outcome.copiesCreated).toBe(2)

    const stats = getLibraryStats()
    expect(stats.works).toBe(2)
    expect(stats.wishlist).toBe(1)
  })

  it("makes the imported books answer the ownership question", () => {
    expect(checkOwnership({ isbn: "9780441013593" }).verdict).toBe("OWNED_SAME_EDITION")
    expect(checkOwnership({ isbn: "9780547928227" }).verdict).toBe("ON_WISHLIST")
  })

  it("is idempotent when duplicates are skipped", () => {
    const before = getLibraryStats()
    const outcome = applyImport(parseCsv(GOODREADS_CSV).rows, { skipDuplicates: true })

    // Nineteen Eighty-Four has no ISBN, so it matches on title+author instead.
    expect(outcome.worksCreated).toBe(0)
    expect(getLibraryStats().works).toBe(before.works)
  })
})

describe("export round trip", () => {
  it("re-imports its own export without inventing new books", () => {
    const csv = toCsv(exportRows())
    const parsed = parseCsv(csv)

    expect(parsed.dialect).toBe("librero")
    expect(parsed.problems).toEqual([])

    const preview = previewImport(parsed.rows)
    // Every exported row already exists, so nothing is new.
    expect(preview.counts.new).toBe(0)
  })

  it("carries the fields the app depends on through the export", () => {
    const rows = exportRows()
    const dune = rows.find((row) => row.title === "Dune")!

    expect(dune.isbn13).toBe("9780441013593")
    expect(dune.format).toBe("mass_market")
    expect(dune.reading_status).toBe("read")
    expect(dune.rating).toBe("5")
    expect(dune.authors).toContain("Frank Herbert")
    expect(dune.wishlist).toBe("false")

    const hobbit = rows.find((row) => row.title === "The Hobbit")!
    expect(hobbit.wishlist).toBe("true")
    // A wishlist entry has no copy, but must still appear in the export.
    expect(hobbit.quantity).toBe("")
  })
})

/*
 * The export is advertised as an escape hatch that reproduces the catalogue
 * exactly, so every field someone can edit has to survive the round trip.
 * `current_page` was added after the first release; this is here so it is not
 * quietly dropped again.
 */
describe("reading position survives the round trip", () => {
  const header =
    "title,authors,reading_status,rating,current_page,format,medium,quantity\n"

  it("reads a page number back out of a Librero CSV", () => {
    const parsed = parseCsv(header + "Dune,Frank Herbert,reading,,120,paperback,physical,1\n")
    expect(parsed.dialect).toBe("librero")
    expect(parsed.rows[0]!.currentPage).toBe(120)
  })

  it("treats a blank page as untracked rather than page zero", () => {
    const parsed = parseCsv(header + "Dune,Frank Herbert,reading,,,paperback,physical,1\n")
    expect(parsed.rows[0]!.currentPage).toBeNull()
  })

  it("keeps page zero distinct from blank", () => {
    const parsed = parseCsv(header + "Dune,Frank Herbert,reading,,0,paperback,physical,1\n")
    expect(parsed.rows[0]!.currentPage).toBe(0)
  })

  it("still imports a CSV written before the column existed", () => {
    const parsed = parseCsv(
      "title,authors,reading_status,format,medium,quantity\nDune,Frank Herbert,read,paperback,physical,1\n"
    )
    expect(parsed.problems).toHaveLength(0)
    expect(parsed.rows[0]!.currentPage).toBeNull()
  })
})
