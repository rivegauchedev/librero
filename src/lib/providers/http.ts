import "server-only"

/**
 * Open Library is genuinely slow: measured 5s for /isbn/, 4s for /works/ and
 * 10s for /authors/ on a single book. Six seconds looked reasonable and was
 * not — it turned a working lookup into "no book found for that ISBN".
 *
 * Twelve is the ceiling for a person standing in a shop holding the book.
 */
const TIMEOUT_MS = 12000

export function userAgent(): string {
  const contact = process.env.LIBRERO_CONTACT_EMAIL
  // Open Library asks that automated clients identify themselves and give a
  // contact address, so they can reach you instead of just blocking you.
  return contact ? `Librero/0.1 (${contact})` : "Librero/0.1"
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

/**
 * Fetch JSON with a timeout and a single retry. Returns null on 404 — a book
 * the provider has never heard of is an ordinary outcome, not an error.
 */
export type FetchOptions = {
  timeoutMs?: number
  /**
   * Retry once on a transient failure. Turn this off where another request is
   * already covering the same ground: a retry doubles the worst-case wait, and
   * two redundant sources are a better answer than one source tried twice.
   */
  retry?: boolean
}

export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T | null> {
  return fetchJsonOnce<T>(
    url,
    options.timeoutMs ?? TIMEOUT_MS,
    options.retry === false ? 1 : 0
  )
}

/**
 * Shorter deadline for requests that only enrich an answer we already have.
 * A description is not worth another ten seconds of someone standing in a shop.
 */
export const ENRICHMENT_TIMEOUT_MS = 4000

/**
 * Like fetchJson, but never throws: any failure becomes null. Use this for the
 * parts of a lookup that merely enrich the result — a slow /authors/ request
 * must not be able to turn a book we already found into a book we did not.
 */
export async function fetchJsonOptional<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T | null> {
  return fetchJson<T>(url, options).catch(() => null)
}

async function fetchJsonOnce<T>(
  url: string,
  timeoutMs: number,
  attempt: number
): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": userAgent() },
      signal: controller.signal,
      redirect: "follow",
    })

    if (response.status === 404) return null
    if (!response.ok) {
      throw new ProviderError(`${url} responded ${response.status}`, response.status)
    }

    return (await response.json()) as T
  } catch (error) {
    // One retry covers the common transient case (timeout, dropped connection),
    // but not a 429: retrying a rate limit immediately just burns the quota.
    if (attempt === 0 && !(error instanceof ProviderError && error.status === 429)) {
      return fetchJsonOnce<T>(url, timeoutMs, 1)
    }
    if (error instanceof ProviderError) throw error
    throw new ProviderError(
      error instanceof Error ? error.message : `Request to ${url} failed`
    )
  } finally {
    clearTimeout(timer)
  }
}
