import "server-only"

const TIMEOUT_MS = 6000

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
export async function fetchJson<T>(url: string, attempt = 0): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

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
    // One retry covers the common transient case (timeout, dropped connection).
    if (attempt === 0) return fetchJson<T>(url, 1)
    if (error instanceof ProviderError) throw error
    throw new ProviderError(
      error instanceof Error ? error.message : `Request to ${url} failed`
    )
  } finally {
    clearTimeout(timer)
  }
}
