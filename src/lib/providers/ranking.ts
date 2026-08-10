import type { OlSearchDoc } from "@/lib/providers/openlibrary-schema"
import { toAuthorMatchKey, toTitleMatchKey } from "@/lib/text"

/*
 * Local re-ranking of Open Library search results.
 *
 * Open Library returns the right books but rarely in the right order. Measured
 * against the live API:
 *
 *   "circe"                -> a study guide and The Night Circus above the novel
 *   "dune"                 -> four sequels above the original
 *   "circe madeline miller" -> "Summary of Circe by Madeline Miller" in the top 3
 *
 * Its `sort=readinglog` parameter fixes the top hit and ruins everything below
 * it (searching "dune" then returns Jane Eyre and Ulysses, which are merely
 * popular). So we ask for a wide candidate set with the popularity fields
 * attached and score it here, where we can weigh relevance and popularity
 * together instead of choosing one.
 */

/**
 * Study guides, summaries and "workbooks" are a large share of Open Library's
 * noise for popular titles, and nobody scanning a shelf wants them. They are
 * demoted rather than dropped: someone may genuinely own a SparkNotes.
 */
const COMPANION_TITLE = /\b(summary|summaries|study guide|studyguide|workbook|analysis|sparknotes|cliffs?notes|quicklet|instaread|conversation starters|trivia[- ]on[- ]books|a novel by|book club)\b/i

const COMPANION_PUBLISHER = /\b(supersummary|bookhabits|blinkist|instaread|everest media|iri|brief books)\b/i

export type ScoredDoc = {
  doc: OlSearchDoc
  score: number
  /** Query overlap alone, ignoring popularity. Zero means nothing matched. */
  relevance: number
}

function normalizeQuery(query: string) {
  const cleaned = query.trim().toLowerCase()
  return {
    titleKey: toTitleMatchKey(cleaned),
    // Every word, so "circe madeline miller" can match the author too.
    words: cleaned
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  }
}

/**
 * Popularity, compressed. Raw counts span several orders of magnitude, so a
 * logarithm keeps a runaway bestseller from burying an exact title match.
 */
function popularity(doc: OlSearchDoc): number {
  const readers = doc.readinglog_count ?? 0
  const ratings = doc.ratings_count ?? 0
  const editions = doc.edition_count ?? 0
  return (
    Math.log10(1 + readers) * 6 +
    Math.log10(1 + ratings) * 3 +
    Math.log10(1 + editions) * 4
  )
}

export function scoreDoc(
  query: string,
  doc: OlSearchDoc
): { score: number; relevance: number } {
  const { titleKey, words } = normalizeQuery(query)
  const title = doc.title ?? ""
  const docTitleKey = toTitleMatchKey(title)
  const authors = doc.author_name ?? []

  let score = 0
  let relevance = 0

  /* --- title -------------------------------------------------------- */
  if (docTitleKey === titleKey) {
    // "circe" typed, "Circe" found. The single strongest signal there is.
    relevance += 100
  } else if (docTitleKey.startsWith(titleKey)) {
    relevance += 45
  } else if (docTitleKey.includes(titleKey)) {
    relevance += 20
  }

  // Partial credit when the query mixes title and author words.
  const titleWords = new Set(docTitleKey.split(" ").filter(Boolean))
  relevance += words.filter((word) => titleWords.has(word)).length * 8

  /* --- author ------------------------------------------------------- */
  const authorKeys = authors.map(toAuthorMatchKey)
  const authorWords = new Set(
    authors.flatMap((name) => name.toLowerCase().split(/\s+/).filter(Boolean))
  )
  if (words.some((word) => authorKeys.includes(word))) {
    // The query names the author's surname: "circe madeline miller".
    relevance += 40
  }
  relevance += words.filter((word) => authorWords.has(word)).length * 6

  /* --- popularity --------------------------------------------------- */
  score = relevance + popularity(doc)

  /* --- penalties ---------------------------------------------------- */
  if (COMPANION_TITLE.test(title)) score -= 70
  if ((doc.publisher ?? []).some((name) => COMPANION_PUBLISHER.test(name))) score -= 40
  if (authors.some((name) => COMPANION_PUBLISHER.test(name))) score -= 40
  // A record with no author is usually a fragment or a bad import.
  if (authors.length === 0) score -= 15
  // Very short "books" are typically pamphlets or chapter extracts.
  const pages = doc.number_of_pages_median
  if (pages !== undefined && pages > 0 && pages < 40) score -= 15

  return { score, relevance }
}

/**
 * Open Library holds several work records for the same book — searching "the
 * song of achilles" returns it three times, "meditations" five. Left alone
 * those duplicates fill the result list and make the catalogue look thinner
 * than it is, which is the opposite of useful when you are trying to find your
 * edition.
 *
 * Collapse them on normalized title plus author surname, keeping the
 * best-scoring record; ties go to whichever has an ISBN, since a result with no
 * ISBN cannot be added in one tap.
 */
function dedupe(scored: (ScoredDoc & { index: number })[]) {
  const best = new Map<string, ScoredDoc & { index: number }>()

  for (const entry of scored) {
    const title = toTitleMatchKey(entry.doc.title ?? "")
    const author = toAuthorMatchKey(entry.doc.author_name?.[0] ?? "")
    const key = `${title}|${author}`

    const incumbent = best.get(key)
    if (!incumbent) {
      best.set(key, entry)
      continue
    }

    const hasIsbn = (doc: OlSearchDoc) => (doc.isbn ?? []).length > 0
    const better =
      entry.score > incumbent.score ||
      (entry.score === incumbent.score && hasIsbn(entry.doc) && !hasIsbn(incumbent.doc))
    if (better) best.set(key, entry)
  }

  return [...best.values()]
}

/** Highest score first. Ties keep Open Library's own order, which is stable. */
export function rankSearchResults(query: string, docs: OlSearchDoc[]): OlSearchDoc[] {
  const scored = docs.map((doc, index) => ({
    doc,
    ...scoreDoc(query, doc),
    index,
  }))

  // Drop results that match nothing in the query — a study guide for an
  // unrelated book has no business appearing just because it is popular. If
  // *nothing* matched (a subject-style query like "science fiction"), keep them
  // all and let popularity order the list rather than returning nothing.
  const relevant = scored.filter((entry) => entry.relevance > 0)
  const candidates = relevant.length > 0 ? relevant : scored

  return dedupe(candidates)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.doc)
}
