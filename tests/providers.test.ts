import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { googleBooks } from "@/lib/providers/googlebooks"
import { mergeBooks, isUsable } from "@/lib/providers/merge"
import { openLibrary } from "@/lib/providers/openlibrary"
import type { NormalizedBook } from "@/lib/providers/types"

const FIXTURES = path.resolve(__dirname, "fixtures")

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8"))
}

/**
 * Routes each provider URL to a recorded response. Tests never touch the
 * network: Open Library's data changes under us, and a test that fails because
 * a volunteer edited a record is worse than no test.
 */
function mockNetwork(routes: Record<string, unknown | null>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input)
      const match = Object.keys(routes).find((pattern) => url.includes(pattern))

      if (match === undefined) {
        throw new Error(`Unexpected request in test: ${url}`)
      }
      if (routes[match] === null) {
        return new Response("Not found", { status: 404 })
      }
      return new Response(JSON.stringify(routes[match]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
  )
}

const OPEN_LIBRARY_DUNE = {
  "search.json?isbn=9780441013593": fixture("ol-search-isbn-dune.json"),
  "/isbn/9780441013593.json": fixture("ol-edition-dune.json"),
  "/works/OL893414W.json": fixture("ol-work-dune.json"),
  "/authors/OL79034A.json": fixture("ol-author-herbert.json"),
}

/*
 * Circe (Bloomsbury 2018) is the regression case that prompted this design.
 *
 * Its Open Library *edition* record carries no authors and no page count, so
 * the old implementation chased /works/ and then /authors/ — three sequential
 * requests against an API measured at 5s, 4s and 10s. Against a 6s timeout the
 * chain failed, and a perfectly well-catalogued book reported as "no book found
 * for that ISBN".
 */
const OPEN_LIBRARY_CIRCE = {
  "search.json?isbn=9781408890080": fixture("ol-search-isbn-circe.json"),
  "/isbn/9781408890080.json": fixture("ol-edition-circe.json"),
  "/works/OL18012166W.json": fixture("ol-work-circe.json"),
}

beforeEach(() => {
  vi.stubEnv("LIBRERO_CONTACT_EMAIL", "test@example.com")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("openLibrary.lookupByIsbn", () => {
  it("normalizes an edition, its work and its authors into one record", async () => {
    mockNetwork(OPEN_LIBRARY_DUNE)

    const book = await openLibrary.lookupByIsbn("9780441013593", "0441013597")

    expect(book).not.toBeNull()
    expect(book!.title).toBe("Dune")
    expect(book!.authors).toEqual(["Frank Herbert"])
    expect(book!.isbn13).toBe("9780441013593")
    expect(book!.isbn10).toBe("0441013597")
    expect(book!.publisher).toBe("Ace Trade")
    expect(book!.pageCount).toBe(544)
    expect(book!.language).toBe("eng")
    expect(book!.openLibraryWorkId).toBe("OL893414W")
    expect(book!.openLibraryEditionId).toBe("OL7524304M")
    expect(book!.source).toBe("openlibrary")
  })

  it("pulls the publish year out of a free-text publish date", async () => {
    mockNetwork(OPEN_LIBRARY_DUNE)
    const book = await openLibrary.lookupByIsbn("9780441013593", "0441013597")
    // The fixture's publish_date is "August 2, 2005".
    expect(book!.publishYear).toBe(2005)
  })

  it("parses the series name and position out of Open Library's string", async () => {
    mockNetwork(OPEN_LIBRARY_DUNE)
    const book = await openLibrary.lookupByIsbn("9780441013593", "0441013597")
    // The fixture's series is "Dune (1); Dune Chronicles, Book 1".
    expect(book!.series).toEqual({ name: "Dune", position: 1 })
  })

  it("flattens the description object form to plain text", async () => {
    mockNetwork(OPEN_LIBRARY_DUNE)
    const book = await openLibrary.lookupByIsbn("9780441013593", "0441013597")
    expect(typeof book!.description).toBe("string")
    expect(book!.description).not.toContain("----------")
  })

  it("returns null for an ISBN Open Library has never seen", async () => {
    mockNetwork({ "search.json": { docs: [] }, "/isbn/": null })
    expect(await openLibrary.lookupByIsbn("9780000000002", null)).toBeNull()
  })
})

describe("openLibrary.lookupByIsbn — resilience", () => {
  it("finds Circe, whose edition record has no authors or page count", async () => {
    mockNetwork(OPEN_LIBRARY_CIRCE)

    const book = await openLibrary.lookupByIsbn("9781408890080", null)

    expect(book).not.toBeNull()
    expect(book!.title).toBe("Circe")
    // Both come from the search document, not the edition record.
    expect(book!.authors).toEqual(["Madeline Miller"])
    expect(book!.pageCount).toBe(404)
    expect(book!.publisher).toBe("Bloombury")
    expect(book!.publishYear).toBe(2018)
  })

  it("still returns the book when the edition endpoint is down", async () => {
    // /isbn/ omitted entirely: any request to it throws in the mock.
    mockNetwork({
      "search.json?isbn=9781408890080": fixture("ol-search-isbn-circe.json"),
      "/works/OL18012166W.json": fixture("ol-work-circe.json"),
    })

    const book = await openLibrary.lookupByIsbn("9781408890080", null)

    expect(book).not.toBeNull()
    expect(book!.title).toBe("Circe")
    expect(book!.authors).toEqual(["Madeline Miller"])
    // The ISBN we asked for is still recorded even without the edition record.
    expect(book!.isbn13).toBe("9781408890080")
  })

  it("still returns the book when the work endpoint is down", async () => {
    mockNetwork({
      "search.json?isbn=9781408890080": fixture("ol-search-isbn-circe.json"),
      "/isbn/9781408890080.json": fixture("ol-edition-circe.json"),
    })

    const book = await openLibrary.lookupByIsbn("9781408890080", null)

    expect(book).not.toBeNull()
    expect(book!.title).toBe("Circe")
    // Only the description is lost — the book itself is not.
    expect(book!.description).toBeNull()
  })

  it("skips the slow author endpoint when the edition names no authors", async () => {
    // Circe's edition record has no `authors`, so there are no keys to fetch —
    // the search document already supplied the name.
    mockNetwork(OPEN_LIBRARY_CIRCE)

    await openLibrary.lookupByIsbn("9781408890080", null)

    const requested = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(
      (call) => String(call[0])
    )
    expect(requested.some((url) => url.includes("/authors/"))).toBe(false)
  })

  it("prefers the edition's own author records over the work's aliases", async () => {
    // The Dune search document lists ["Frank Herbert", "Френк Герберт"]; the
    // edition's author record is the authoritative one.
    mockNetwork(OPEN_LIBRARY_DUNE)

    const book = await openLibrary.lookupByIsbn("9780441013593", "0441013597")

    expect(book!.authors).toEqual(["Frank Herbert"])
  })

  it("falls back to the search document when the author endpoint fails", async () => {
    const { "/authors/OL79034A.json": _dropped, ...withoutAuthors } = OPEN_LIBRARY_DUNE
    mockNetwork(withoutAuthors)

    const book = await openLibrary.lookupByIsbn("9780441013593", "0441013597")

    expect(book).not.toBeNull()
    expect(book!.authors).toContain("Frank Herbert")
  })
})

describe("openLibrary.search", () => {
  it("maps search docs and picks a representative ISBN-13", async () => {
    mockNetwork({ "/search.json": fixture("ol-search-dune.json") })

    const results = await openLibrary.search("dune herbert", 3)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.title).toBeTruthy()
    expect(results[0]!.source).toBe("openlibrary")
    for (const result of results) {
      if (result.isbn13) expect(result.isbn13).toHaveLength(13)
      if (result.isbn10) expect(result.isbn10).toHaveLength(10)
    }
  })
})

describe("googleBooks.lookupByIsbn", () => {
  it("normalizes a volume into the same shape", async () => {
    mockNetwork({ "googleapis.com/books": fixture("gb-isbn-dune.json") })

    const book = await googleBooks.lookupByIsbn("9780441013593", "0441013597")

    expect(book).not.toBeNull()
    expect(book!.title).toContain("Dune")
    expect(book!.source).toBe("googlebooks")
    expect(book!.pageCount).toBeGreaterThan(0)
    // Google Books cannot tell hardcover from paperback.
    expect(book!.format).toBeNull()
    expect(book!.coverUrl).toMatch(/^https:/)
  })

  it("returns null when the volume list is empty", async () => {
    mockNetwork({ "googleapis.com/books": { items: [] } })
    expect(await googleBooks.lookupByIsbn("9780000000002", null)).toBeNull()
  })
})

describe("mergeBooks", () => {
  const openLibraryRecord: NormalizedBook = {
    title: "Dune",
    subtitle: null,
    authors: ["Frank Herbert"],
    description: null,
    firstPublishYear: 1965,
    subjects: [],
    series: { name: "Dune", position: 1 },
    isbn13: "9780441013593",
    isbn10: "0441013597",
    publisher: "Ace Trade",
    publishYear: 2005,
    pageCount: null,
    language: "eng",
    format: "paperback",
    coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
    openLibraryWorkId: "OL893414W",
    openLibraryEditionId: "OL7524304M",
    source: "openlibrary",
  }

  const googleRecord: NormalizedBook = {
    ...openLibraryRecord,
    title: "Dune (Movie Tie-In)",
    authors: ["Frank Patrick Herbert"],
    description: "A desert planet.",
    pageCount: 544,
    format: null,
    series: null,
    coverUrl: "https://books.google.com/x.jpg",
    openLibraryWorkId: null,
    openLibraryEditionId: null,
    source: "googlebooks",
  }

  it("keeps Open Library's identity fields", () => {
    const merged = mergeBooks(openLibraryRecord, googleRecord)
    expect(merged.title).toBe("Dune")
    expect(merged.authors).toEqual(["Frank Herbert"])
    expect(merged.series).toEqual({ name: "Dune", position: 1 })
    expect(merged.openLibraryWorkId).toBe("OL893414W")
    expect(merged.source).toBe("openlibrary")
  })

  it("fills the gaps from Google Books", () => {
    const merged = mergeBooks(openLibraryRecord, googleRecord)
    expect(merged.description).toBe("A desert planet.")
    expect(merged.pageCount).toBe(544)
  })

  it("is a no-op without a secondary record", () => {
    expect(mergeBooks(openLibraryRecord, null)).toEqual(openLibraryRecord)
  })
})

describe("isUsable", () => {
  it("rejects records with no real title", () => {
    expect(isUsable(null)).toBe(false)
    expect(isUsable({ title: "Untitled" } as NormalizedBook)).toBe(false)
    expect(isUsable({ title: "  " } as NormalizedBook)).toBe(false)
    expect(isUsable({ title: "Dune" } as NormalizedBook)).toBe(true)
  })
})
