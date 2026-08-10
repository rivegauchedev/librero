import "server-only"

import type { EditionFormat } from "@/db/schema"
import { fetchJson } from "@/lib/providers/http"
import type { MetadataProvider, NormalizedBook, SearchResult } from "@/lib/providers/types"

const BASE = "https://openlibrary.org"
const COVERS = "https://covers.openlibrary.org"

/* ------------------------------------------------------------ API shapes */

type OlEdition = {
  key: string
  title?: string
  subtitle?: string
  authors?: { key: string }[]
  works?: { key: string }[]
  publishers?: string[]
  publish_date?: string
  number_of_pages?: number
  languages?: { key: string }[]
  isbn_10?: string[]
  isbn_13?: string[]
  covers?: number[]
  physical_format?: string
  series?: string[]
}

type OlWork = {
  key: string
  title?: string
  subtitle?: string
  description?: string | { value?: string }
  first_publish_date?: string
  subjects?: string[]
  authors?: { author?: { key: string } }[]
  covers?: number[]
}

type OlAuthor = { key: string; name?: string }

type OlSearchResponse = {
  docs?: {
    key?: string
    title?: string
    subtitle?: string
    author_name?: string[]
    first_publish_year?: number
    isbn?: string[]
    cover_i?: number
    edition_count?: number
  }[]
}

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

/* -------------------------------------------------------------- provider */

async function fetchAuthorNames(keys: string[]): Promise<string[]> {
  const authors = await Promise.all(
    keys.map((key) => fetchJson<OlAuthor>(`${BASE}${key}.json`).catch(() => null))
  )
  return authors.map((author) => author?.name).filter((name): name is string => !!name)
}

export const openLibrary: MetadataProvider = {
  name: "openlibrary",

  async lookupByIsbn(isbn13, isbn10) {
    const edition = await fetchJson<OlEdition>(`${BASE}/isbn/${isbn13}.json`)
    if (!edition) return null

    const workKey = edition.works?.[0]?.key
    const work = workKey ? await fetchJson<OlWork>(`${BASE}${workKey}.json`) : null

    // Author records live on the edition when it has them, on the work otherwise.
    const authorKeys =
      edition.authors?.map((a) => a.key) ??
      work?.authors?.map((a) => a.author?.key).filter((key): key is string => !!key) ??
      []
    const authors = await fetchAuthorNames(authorKeys)

    const publishYear = yearFrom(edition.publish_date)

    return {
      title: work?.title ?? edition.title ?? "Untitled",
      subtitle: edition.subtitle ?? work?.subtitle ?? null,
      authors,
      description: plainDescription(work?.description),
      firstPublishYear: yearFrom(work?.first_publish_date) ?? publishYear,
      subjects: (work?.subjects ?? []).slice(0, 12),
      series: parseSeries(edition.series),

      isbn13: edition.isbn_13?.[0] ?? isbn13,
      isbn10: edition.isbn_10?.[0] ?? isbn10,
      publisher: edition.publishers?.[0] ?? null,
      publishYear,
      pageCount: edition.number_of_pages ?? null,
      language: languageFrom(edition.languages),
      format: toFormat(edition.physical_format),

      coverUrl:
        coverUrlFromId(edition.covers?.[0]) ??
        coverUrlFromId(work?.covers?.[0]) ??
        `${COVERS}/b/isbn/${isbn13}-L.jpg`,
      openLibraryWorkId: stripKey(workKey, "/works/"),
      openLibraryEditionId: stripKey(edition.key, "/books/"),
      source: "openlibrary",
    }
  },

  async search(query, limit) {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      fields: "key,title,subtitle,author_name,first_publish_year,isbn,cover_i,edition_count",
    })
    const response = await fetchJson<OlSearchResponse>(`${BASE}/search.json?${params}`)

    return (response?.docs ?? []).map((doc): SearchResult => {
      // `isbn` is every ISBN across every edition; the 13-digit ones are the
      // useful half, and the first is as good a representative as any.
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
    })
  },
}
