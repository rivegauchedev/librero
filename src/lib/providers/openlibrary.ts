import "server-only"

import type { EditionFormat } from "@/db/schema"
import {
  ENRICHMENT_TIMEOUT_MS,
  fetchJson,
  fetchJsonOptional,
} from "@/lib/providers/http"
import type {
  OlAuthor,
  OlEdition,
  OlSearchDoc,
  OlSearchResponse,
  OlWork,
} from "@/lib/providers/openlibrary-schema"
import { rankSearchResults } from "@/lib/providers/ranking"
import type { MetadataProvider, NormalizedBook, SearchResult } from "@/lib/providers/types"

const BASE = "https://openlibrary.org"
const COVERS = "https://covers.openlibrary.org"

/** Fetched from search.json, which returns everything below in one request. */
const SEARCH_FIELDS = [
  "key",
  "title",
  "subtitle",
  "author_name",
  "author_key",
  "first_publish_year",
  "isbn",
  "cover_i",
  "edition_count",
  "readinglog_count",
  "ratings_count",
  "number_of_pages_median",
  "language",
  "publisher",
].join(",")

/* ------------------------------------------------------------ conversion */

function plainDescription(value: OlWork["description"]): string | null {
  if (!value) return null
  const text = typeof value === "string" ? value : (value.value ?? "")
  // Open Library descriptions often end with a source credit on its own line.
  return text.split("\n----------")[0]!.trim() || null
}

function yearFrom(value: string | undefined): number | null {
  if (!value) return null
  const match = value.match(/\b(1\d{3}|20\d{2})\b/)
  return match ? Number(match[1]) : null
}

/** Open Library's free-text `physical_format` mapped onto our fixed set. */
function toFormat(physicalFormat: string | undefined): EditionFormat | null {
  if (!physicalFormat) return null
  const value = physicalFormat.toLowerCase()
  if (value.includes("mass market")) return "mass_market"
  if (value.includes("hardcover") || value.includes("hardback")) return "hardcover"
  if (value.includes("paperback") || value.includes("softcover")) return "paperback"
  if (value.includes("ebook") || value.includes("electronic")) return "ebook"
  if (value.includes("audio")) return "audiobook"
  return null
}

/** "Dune (1); Dune Chronicles, Book 1" -> { name: "Dune", position: 1 }. */
function parseSeries(series: string[] | undefined) {
  const raw = series?.[0]
  if (!raw) return null
  const first = raw.split(";")[0]!.trim()
  const match = first.match(/^(.*?)\s*\((\d+(?:\.\d+)?)\)$/)
  if (match) return { name: match[1]!.trim(), position: Number(match[2]) }
  return { name: first, position: null }
}

function languageFrom(languages: OlEdition["languages"]): string | null {
  const key = languages?.[0]?.key
  return key ? key.replace("/languages/", "") : null
}

function coverUrlFromId(coverId: number | undefined): string | null {
  return coverId ? `${COVERS}/b/id/${coverId}-L.jpg` : null
}

function stripKey(key: string | undefined, prefix: string): string | null {
  return key?.startsWith(prefix) ? key.slice(prefix.length) : null
}

export function docToSearchResult(doc: OlSearchDoc): SearchResult {
  // `isbn` lists every ISBN across every edition; the first 13-digit one is as
  // good a representative as any.
  const isbns = doc.isbn ?? []
  return {
    title: doc.title ?? "Untitled",
    subtitle: doc.subtitle ?? null,
    authors: doc.author_name ?? [],
    firstPublishYear: doc.first_publish_year ?? null,
    isbn13: isbns.find((value) => value.length === 13) ?? null,
    isbn10: isbns.find((value) => value.length === 10) ?? null,
    coverUrl: coverUrlFromId(doc.cover_i),
    openLibraryWorkId: stripKey(doc.key, "/works/"),
    editionCount: doc.edition_count ?? null,
    source: "openlibrary",
  }
}

/* -------------------------------------------------------------- provider */

async function searchDocs(
  params: URLSearchParams,
  options: { retry?: boolean } = {}
): Promise<OlSearchDoc[]> {
  params.set("fields", SEARCH_FIELDS)
  const response = await fetchJson<OlSearchResponse>(
    `${BASE}/search.json?${params}`,
    options
  )
  return response?.docs ?? []
}

export const openLibrary: MetadataProvider = {
  name: "openlibrary",

  /**
   * Look up one edition.
   *
   * The obvious implementation — /isbn/ then /works/ then /authors/ — is three
   * sequential requests against an API that regularly takes five to ten seconds
   * each, and any one of them failing loses the whole book. That is exactly how
   * a perfectly well-catalogued title came back as "no book found".
   *
   * Instead: `search.json?isbn=` answers title, authors, year, page count and
   * cover in a single request, and runs *in parallel* with the /isbn/ call that
   * adds edition detail. Everything after that is enrichment — fetched with
   * fetchJsonOptional so a slow request degrades the record rather than losing
   * it.
   */
  async lookupByIsbn(isbn13, isbn10) {
    // Neither is retried: they are redundant, so a failure on one is already
    // covered by the other, and retrying would double the worst-case wait.
    const [docs, edition] = await Promise.all([
      searchDocs(new URLSearchParams({ isbn: isbn13, limit: "1" }), {
        retry: false,
      }).catch(() => []),
      fetchJsonOptional<OlEdition>(`${BASE}/isbn/${isbn13}.json`, { retry: false }),
    ])

    const doc = docs[0]
    if (!doc && !edition) return null

    const workKey = edition?.works?.[0]?.key ?? (doc?.key ? doc.key : undefined)
    // Enrichment only — description and subjects. Held to a short deadline so a
    // slow work record costs a description, not ten seconds of waiting.
    const work = workKey
      ? await fetchJsonOptional<OlWork>(`${BASE}${workKey}.json`, {
          timeoutMs: ENRICHMENT_TIMEOUT_MS,
          retry: false,
        })
      : null

    // Authors, in order of trustworthiness.
    //
    // The edition's own author records win when it has them: search documents
    // list every author name attached to the *work*, which includes
    // transliterations — Dune comes back as ["Frank Herbert", "Френк Герберт"].
    //
    // When the edition names no authors (Circe's does not) the search document
    // is all we have, and it is enough. Either way the author requests are
    // optional: they are the slowest call in the chain, and losing them must
    // cost us the author list, not the book.
    const fetchAuthorNames = async (keys: string[]) => {
      const fetched = await Promise.all(
        keys
          .slice(0, 4)
          .map((key) =>
            fetchJsonOptional<OlAuthor>(`${BASE}${key}.json`, {
              timeoutMs: ENRICHMENT_TIMEOUT_MS,
              retry: false,
            })
          )
      )
      return fetched.map((a) => a?.name).filter((name): name is string => !!name)
    }

    const editionAuthorKeys = edition?.authors?.map((a) => a.key) ?? []
    const workAuthorKeys =
      work?.authors?.map((a) => a.author?.key).filter((key): key is string => !!key) ?? []

    let authors: string[] = []
    if (editionAuthorKeys.length > 0) {
      authors = await fetchAuthorNames(editionAuthorKeys)
    }
    if (authors.length === 0) authors = doc?.author_name ?? []
    if (authors.length === 0 && workAuthorKeys.length > 0) {
      authors = await fetchAuthorNames(workAuthorKeys)
    }

    const publishYear = yearFrom(edition?.publish_date) ?? doc?.first_publish_year ?? null

    return {
      title: work?.title ?? edition?.title ?? doc?.title ?? "Untitled",
      subtitle: edition?.subtitle ?? work?.subtitle ?? doc?.subtitle ?? null,
      authors,
      description: plainDescription(work?.description),
      firstPublishYear:
        yearFrom(work?.first_publish_date) ?? doc?.first_publish_year ?? publishYear,
      subjects: (work?.subjects ?? []).slice(0, 12),
      series: parseSeries(edition?.series),

      isbn13: edition?.isbn_13?.[0] ?? isbn13,
      isbn10: edition?.isbn_10?.[0] ?? isbn10,
      publisher: edition?.publishers?.[0] ?? doc?.publisher?.[0] ?? null,
      publishYear,
      pageCount: edition?.number_of_pages ?? doc?.number_of_pages_median ?? null,
      language: languageFrom(edition?.languages),
      format: toFormat(edition?.physical_format),

      coverUrl:
        coverUrlFromId(edition?.covers?.[0]) ??
        coverUrlFromId(doc?.cover_i) ??
        coverUrlFromId(work?.covers?.[0]) ??
        `${COVERS}/b/isbn/${isbn13}-L.jpg`,
      openLibraryWorkId: stripKey(workKey, "/works/"),
      openLibraryEditionId: stripKey(edition?.key, "/books/"),
      source: "openlibrary",
    }
  },

  /**
   * Free-text search.
   *
   * Open Library's own relevance ordering is poor for the queries people
   * actually type: "circe" returns a study guide above the novel, and "dune"
   * returns four sequels before the original. Rather than accept that, we ask
   * for a wide candidate set together with the popularity fields, and rank it
   * ourselves. See ranking.ts.
   */
  async search(query, limit) {
    const docs = await searchDocs(
      new URLSearchParams({ q: query, limit: String(Math.max(limit * 3, 40)) })
    )

    return rankSearchResults(query, docs).slice(0, limit).map(docToSearchResult)
  },
}
