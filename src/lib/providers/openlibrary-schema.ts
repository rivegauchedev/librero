/**
 * Open Library's raw API response shapes.
 *
 * These live apart from the provider itself so that ranking.ts can describe the
 * documents it scores without importing the provider that calls it — otherwise
 * the two modules import each other, and a cycle (even a type-only one) is a
 * cycle.
 */

export type OlEdition = {
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

export type OlWork = {
  key: string
  title?: string
  subtitle?: string
  description?: string | { value?: string }
  first_publish_date?: string
  subjects?: string[]
  authors?: { author?: { key: string } }[]
  covers?: number[]
}

export type OlAuthor = { key: string; name?: string }

/** One row of a search.json response, limited to the fields we request. */
export type OlSearchDoc = {
  key?: string
  title?: string
  subtitle?: string
  author_name?: string[]
  first_publish_year?: number
  isbn?: string[]
  cover_i?: number
  edition_count?: number
  readinglog_count?: number
  ratings_count?: number
  number_of_pages_median?: number
  publisher?: string[]
  language?: string[]
}

export type OlSearchResponse = { numFound?: number; docs?: OlSearchDoc[] }
