const LEADING_ARTICLES = /^(the|a|an|el|la|los|las|un|una|le|les|der|die|das)\s+/i

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

/** "The Left Hand of Darkness" -> "Left Hand of Darkness", for alphabetical browsing. */
export function toSortTitle(title: string): string {
  return title.trim().replace(LEADING_ARTICLES, "")
}

/**
 * Aggressively normalized title used to decide "is this the same book?".
 * Drops the subtitle, diacritics, leading articles and all punctuation, so
 * "Dune: Special Edition" and "DUNE" collapse to the same key.
 */
export function toTitleMatchKey(title: string): string {
  const withoutSubtitle = title.split(":")[0] ?? title
  return stripDiacritics(withoutSubtitle)
    .toLowerCase()
    .replace(LEADING_ARTICLES, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Surname-only key for author matching — enough to link "Ursula K. Le Guin"
 * and "Le Guin, Ursula K." without over-matching on initials.
 */
export function toAuthorMatchKey(name: string): string {
  const normalized = stripDiacritics(name).toLowerCase().replace(/[^a-z\s,]/g, " ")
  // "Le Guin, Ursula K." — the surname is everything before the comma.
  const surname = normalized.includes(",")
    ? normalized.split(",")[0]!
    : (normalized.trim().split(/\s+/).pop() ?? "")
  return surname.replace(/\s+/g, " ").trim()
}

/** "Ursula K. Le Guin" -> "Le Guin, Ursula K." for alphabetical author lists. */
export function toSortName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.includes(",")) return trimmed
  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) return trimmed
  const surname = parts.pop()!
  return `${surname}, ${parts.join(" ")}`
}

/** Escape a user query for an FTS5 MATCH expression, as a prefix-matched AND of terms. */
export function toFtsQuery(input: string): string {
  const terms = stripDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  if (terms.length === 0) return ""
  return terms.map((term) => `"${term}"*`).join(" AND ")
}
