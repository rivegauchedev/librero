import "server-only"

import { fetchJson } from "@/lib/providers/http"
import type { MetadataProvider, NormalizedBook, SearchResult } from "@/lib/providers/types"

const BASE = "https://www.googleapis.com/books/v1/volumes"

type GoogleVolume = {
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    pageCount?: number
    categories?: string[]
    language?: string
    industryIdentifiers?: { type?: string; identifier?: string }[]
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  }
}

type GoogleResponse = { items?: GoogleVolume[] }

function withKey(params: URLSearchParams): string {
  const key = process.env.GOOGLE_BOOKS_API_KEY
  if (key) params.set("key", key)
  return `${BASE}?${params}`
}

function yearFrom(value: string | undefined): number | null {
  const match = value?.match(/^(\d{4})/)
  return match ? Number(match[1]) : null
}

function isbnsOf(volume: GoogleVolume) {
  const ids = volume.volumeInfo?.industryIdentifiers ?? []
  return {
    isbn13: ids.find((id) => id.type === "ISBN_13")?.identifier ?? null,
    isbn10: ids.find((id) => id.type === "ISBN_10")?.identifier ?? null,
  }
}

/** Google's thumbnails default to a tiny zoom level and http; fix both. */
function coverUrlOf(volume: GoogleVolume): string | null {
  const raw = volume.volumeInfo?.imageLinks?.thumbnail ?? volume.volumeInfo?.imageLinks?.smallThumbnail
  if (!raw) return null
  return raw.replace(/^http:/, "https:").replace(/&zoom=\d/, "&zoom=1")
}

function toNormalized(volume: GoogleVolume): NormalizedBook | null {
  const info = volume.volumeInfo
  if (!info?.title) return null
  const { isbn13, isbn10 } = isbnsOf(volume)
  const year = yearFrom(info.publishedDate)

  return {
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    description: info.description ?? null,
    firstPublishYear: year,
    subjects: (info.categories ?? []).slice(0, 12),
    // Google Books has no series concept.
    series: null,

    isbn13,
    isbn10,
    publisher: info.publisher ?? null,
    publishYear: year,
    pageCount: info.pageCount ?? null,
    language: info.language ?? null,
    // Google Books does not distinguish hardcover from paperback.
    format: null,

    coverUrl: coverUrlOf(volume),
    openLibraryWorkId: null,
    openLibraryEditionId: null,
    source: "googlebooks",
  }
}

export const googleBooks: MetadataProvider = {
  name: "googlebooks",

  async lookupByIsbn(isbn13) {
    const url = withKey(new URLSearchParams({ q: `isbn:${isbn13}`, maxResults: "1" }))
    const response = await fetchJson<GoogleResponse>(url)
    const volume = response?.items?.[0]
    return volume ? toNormalized(volume) : null
  },

  async search(query, limit) {
    const url = withKey(
      new URLSearchParams({ q: query, maxResults: String(Math.min(limit, 40)) })
    )
    const response = await fetchJson<GoogleResponse>(url)

    return (response?.items ?? [])
      .map((volume) => toNormalized(volume))
      .filter((book): book is NormalizedBook => book !== null)
      .map(
        (book): SearchResult => ({
          title: book.title,
          subtitle: book.subtitle,
          authors: book.authors,
          firstPublishYear: book.firstPublishYear,
          isbn13: book.isbn13,
          isbn10: book.isbn10,
          coverUrl: book.coverUrl,
          openLibraryWorkId: null,
          editionCount: null,
          source: "googlebooks",
        })
      )
  },
}
