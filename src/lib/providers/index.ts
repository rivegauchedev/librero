import "server-only"

import { parseIsbn } from "@/lib/isbn"
import { cached } from "@/lib/providers/cache"
import { googleBooks } from "@/lib/providers/googlebooks"
import { isUsable, mergeBooks } from "@/lib/providers/merge"
import { openLibrary } from "@/lib/providers/openlibrary"
import type { NormalizedBook, SearchResult } from "@/lib/providers/types"

export type { NormalizedBook, SearchResult } from "@/lib/providers/types"

/**
 * Look up one book by ISBN.
 *
 * Open Library is asked first: it is the only free source with a real
 * work-versus-edition model, which is what our catalogue is built on. Google
 * Books is consulted when Open Library has nothing, or has a record too thin to
 * be useful — common for very recent or non-English printings.
 */
export async function lookupByIsbn(input: string): Promise<NormalizedBook | null> {
  const isbn = parseIsbn(input)
  if (!isbn?.isbn13) return null
  const { isbn13, isbn10 } = isbn

  return cached("merged", `isbn:${isbn13}`, async () => {
    const fromOpenLibrary = await openLibrary
      .lookupByIsbn(isbn13, isbn10)
      .catch(() => null)

    // Only pay for the second call when the first left something to fill in.
    const needsFallback =
      !isUsable(fromOpenLibrary) ||
      !fromOpenLibrary.description ||
      !fromOpenLibrary.pageCount ||
      fromOpenLibrary.authors.length === 0

    const fromGoogle = needsFallback
      ? await googleBooks.lookupByIsbn(isbn13, isbn10).catch(() => null)
      : null

    if (isUsable(fromOpenLibrary)) return mergeBooks(fromOpenLibrary, fromGoogle)
    if (isUsable(fromGoogle)) return fromGoogle
    return null
  })
}

/**
 * Free-text search. Open Library only; Google Books is a fallback for when it
 * returns nothing at all, not a second set of results to merge — interleaving
 * two rankings makes the list worse, not better.
 */
export async function searchBooks(
  query: string,
  limit = 20
): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  return cached("merged", `search:${limit}:${trimmed.toLowerCase()}`, async () => {
    const results = await openLibrary.search(trimmed, limit).catch(() => [])
    if (results.length > 0) return results
    return googleBooks.search(trimmed, limit).catch(() => [])
  })
}
