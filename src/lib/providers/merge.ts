import type { NormalizedBook } from "@/lib/providers/types"

/**
 * Field-by-field merge of an Open Library record with a Google Books one.
 *
 * Open Library wins on identity (title, authors, series, work/edition ids) —
 * that is the model our catalogue is built on. Google Books fills the gaps it
 * is better at: page counts, descriptions and covers for recent titles.
 */
export function mergeBooks(
  primary: NormalizedBook,
  secondary: NormalizedBook | null
): NormalizedBook {
  if (!secondary) return primary

  return {
    ...primary,
    subtitle: primary.subtitle ?? secondary.subtitle,
    authors: primary.authors.length > 0 ? primary.authors : secondary.authors,
    description: primary.description ?? secondary.description,
    firstPublishYear: primary.firstPublishYear ?? secondary.firstPublishYear,
    subjects: primary.subjects.length > 0 ? primary.subjects : secondary.subjects,
    series: primary.series ?? secondary.series,

    isbn13: primary.isbn13 ?? secondary.isbn13,
    isbn10: primary.isbn10 ?? secondary.isbn10,
    publisher: primary.publisher ?? secondary.publisher,
    publishYear: primary.publishYear ?? secondary.publishYear,
    pageCount: primary.pageCount ?? secondary.pageCount,
    language: primary.language ?? secondary.language,
    format: primary.format ?? secondary.format,

    coverUrl: primary.coverUrl ?? secondary.coverUrl,
  }
}

/** A record is too thin to be worth showing if we cannot even name the book. */
export function isUsable(book: NormalizedBook | null): book is NormalizedBook {
  return !!book && book.title.trim().length > 0 && book.title !== "Untitled"
}
