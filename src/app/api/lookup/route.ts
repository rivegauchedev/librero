import { NextResponse } from "next/server"

import { getSession } from "@/lib/session"
import { checkOwnership, type OwnershipCheck } from "@/lib/ownership"
import { searchLibrary } from "@/db/queries/search"
import { looksLikeIsbn, parseIsbn } from "@/lib/isbn"
import { lookupByIsbn, searchBooks } from "@/lib/providers"
import type { NormalizedBook, SearchResult } from "@/lib/providers/types"

export type LookupCandidate = {
  title: string
  subtitle: string | null
  authors: string[]
  firstPublishYear: number | null
  isbn13: string | null
  coverUrl: string | null
  publisher: string | null
  pageCount: number | null
  ownership: OwnershipCheck
}

/** A book already on the shelf, matched locally rather than via a provider. */
export type ShelfMatch = {
  workId: number
  title: string
  authors: string
  coverPath: string | null
  formats: string[]
  copyCount: number
  locations: string[]
  isWishlist: boolean
}

export type LookupResponse = {
  /** "isbn" means one confident answer; "search" means a list to choose from. */
  mode: "isbn" | "search"
  /** Set when the input looked like an ISBN but failed its checksum. */
  invalidIsbn?: boolean
  /**
   * Matches from your own catalogue, shown above provider results. Open
   * Library's relevance ranking is poor for bare titles — searching "dune"
   * returns the sequels before the original — so the shelf you already have
   * must answer first. It is also the only part that works offline.
   */
  shelf: ShelfMatch[]
  candidates: LookupCandidate[]
  /** Set when the provider could not be reached but local results still stand. */
  providerUnavailable?: boolean
}

function fromBook(book: NormalizedBook): LookupCandidate {
  return {
    title: book.title,
    subtitle: book.subtitle,
    authors: book.authors,
    firstPublishYear: book.firstPublishYear,
    isbn13: book.isbn13,
    coverUrl: book.coverUrl,
    publisher: book.publisher,
    pageCount: book.pageCount,
    ownership: checkOwnership({
      isbn: book.isbn13,
      title: book.title,
      primaryAuthor: book.authors[0] ?? null,
      openLibraryWorkId: book.openLibraryWorkId,
    }),
  }
}

function fromSearchResult(result: SearchResult): LookupCandidate {
  return {
    title: result.title,
    subtitle: result.subtitle,
    authors: result.authors,
    firstPublishYear: result.firstPublishYear,
    isbn13: result.isbn13,
    coverUrl: result.coverUrl,
    publisher: null,
    pageCount: null,
    ownership: checkOwnership({
      isbn: result.isbn13,
      title: result.title,
      primaryAuthor: result.authors[0] ?? null,
      openLibraryWorkId: result.openLibraryWorkId,
    }),
  }
}

/*
 * Ownership changes the moment a book is added, and the check screen re-queries
 * the *same* URL right afterwards — so this response must never be cached.
 * Without this the browser's heuristic cache happily replays "not on your
 * shelf" seconds after you put the book on it.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const

function json(body: LookupResponse) {
  return NextResponse.json(body, { headers: NO_STORE })
}

function shelfMatches(query: string): ShelfMatch[] {
  return searchLibrary(query, 5).map((work) => ({
    workId: work.id,
    title: work.title,
    authors: work.authors,
    coverPath: work.coverPath,
    formats: work.formats ? work.formats.split(",").filter(Boolean) : [],
    copyCount: work.copyCount,
    locations: work.locations ? work.locations.split(",").filter(Boolean) : [],
    isWishlist: work.isWishlist,
  }))
}

/**
 * Backs the bookstore screen. Every candidate comes back with its ownership
 * verdict already resolved, so the page renders the answer immediately instead
 * of making a second round trip per result.
 */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim()
  if (query.length < 2) {
    return json({ mode: "search", shelf: [], candidates: [] })
  }

  if (looksLikeIsbn(query)) {
    if (!parseIsbn(query)) {
      // The shape of an ISBN but a bad checksum — almost always a misread scan.
      return json({
        mode: "isbn",
        invalidIsbn: true,
        shelf: [],
        candidates: [],
      })
    }

    const shelf = shelfMatches(query)
    try {
      const book = await lookupByIsbn(query)
      return json({
        mode: "isbn",
        shelf,
        candidates: book ? [fromBook(book)] : [],
      })
    } catch (error) {
      console.error("ISBN lookup failed:", error)
      // A provider outage must not hide the answer we already had locally.
      return json({
        mode: "isbn",
        shelf,
        candidates: [],
        providerUnavailable: true,
      })
    }
  }

  const shelf = shelfMatches(query)
  try {
    const results = await searchBooks(query, 20)
    return json({
      mode: "search",
      shelf,
      candidates: results.map(fromSearchResult),
    })
  } catch (error) {
    console.error("Search failed:", error)
    return json({
      mode: "search",
      shelf,
      candidates: [],
      providerUnavailable: true,
    })
  }
}
