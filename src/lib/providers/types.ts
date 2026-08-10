import type { EditionFormat, MetadataSource } from "@/db/schema"

/**
 * The one shape both providers map into, so nothing downstream ever branches on
 * where a book's metadata came from.
 */
export type NormalizedBook = {
  title: string
  subtitle: string | null
  authors: string[]
  description: string | null
  firstPublishYear: number | null
  subjects: string[]
  series: { name: string; position: number | null } | null

  /** Edition-level fields. */
  isbn10: string | null
  isbn13: string | null
  publisher: string | null
  publishYear: number | null
  pageCount: number | null
  language: string | null
  format: EditionFormat | null

  coverUrl: string | null
  openLibraryWorkId: string | null
  openLibraryEditionId: string | null
  source: MetadataSource
}

export type SearchResult = Pick<
  NormalizedBook,
  | "title"
  | "subtitle"
  | "authors"
  | "firstPublishYear"
  | "isbn13"
  | "isbn10"
  | "coverUrl"
  | "openLibraryWorkId"
  | "source"
> & {
  /** How many editions the provider knows of — a rough popularity signal. */
  editionCount: number | null
}

export interface MetadataProvider {
  readonly name: MetadataSource
  lookupByIsbn(isbn13: string, isbn10: string | null): Promise<NormalizedBook | null>
  search(query: string, limit: number): Promise<SearchResult[]>
}
