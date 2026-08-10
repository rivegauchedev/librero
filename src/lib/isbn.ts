/** Strip hyphens, spaces and normalize the trailing check character. */
export function normalizeIsbn(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase()
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += (10 - i) * Number(isbn[i])
  }
  sum += isbn[9] === "X" ? 10 : Number(isbn[9])
  return sum % 11 === 0
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 13; i++) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return sum % 10 === 0
}

export function isbn10To13(isbn10: string): string | null {
  if (!isValidIsbn10(isbn10)) return null
  const core = `978${isbn10.slice(0, 9)}`
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return `${core}${(10 - (sum % 10)) % 10}`
}

export function isbn13To10(isbn13: string): string | null {
  if (!isValidIsbn13(isbn13) || !isbn13.startsWith("978")) return null
  const core = isbn13.slice(3, 12)
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += (10 - i) * Number(core[i])
  }
  const check = (11 - (sum % 11)) % 11
  return `${core}${check === 10 ? "X" : check}`
}

export type ParsedIsbn = {
  isbn10: string | null
  isbn13: string | null
}

/**
 * Accepts either form (hyphenated or not) and returns both, so callers always
 * have the ISBN-13 to key ownership lookups on. Returns null if the input is
 * not a checksum-valid ISBN — barcode scanners do misread, and a bad ISBN
 * silently looked up as a real one is worse than an error.
 */
export function parseIsbn(input: string): ParsedIsbn | null {
  const normalized = normalizeIsbn(input)

  if (isValidIsbn13(normalized)) {
    return { isbn13: normalized, isbn10: isbn13To10(normalized) }
  }
  if (isValidIsbn10(normalized)) {
    return { isbn10: normalized, isbn13: isbn10To13(normalized) }
  }
  return null
}

/** True when the string looks like someone typed/scanned an ISBN rather than a title. */
export function looksLikeIsbn(input: string): boolean {
  const normalized = normalizeIsbn(input)
  return /^\d{9}[\dX]$/.test(normalized) || /^\d{13}$/.test(normalized)
}
