import "server-only"

import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import { assertFetchableUrl, UnsafeUrlError } from "@/lib/net"
import { COVERS_DIR } from "@/lib/paths"
import { userAgent } from "@/lib/providers/http"

const MAX_COVER_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 8000
const MAX_REDIRECTS = 3

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

export class CoverError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CoverError"
  }
}

/** Whether an operator has opted into fetching covers from their own network. */
export function allowsPrivateCoverUrls(): boolean {
  return process.env.ALLOW_PRIVATE_COVER_URLS === "true"
}

/**
 * Write image bytes into the cover store and return the file name.
 *
 * Content-addressed, so the same cover used by two editions is stored once and
 * the name can be cached forever by the browser.
 */
async function store(bytes: Buffer, extension: string): Promise<string> {
  const digest = crypto.createHash("sha1").update(bytes).digest("hex")
  const fileName = `${digest}.${extension}`

  await fs.mkdir(COVERS_DIR, { recursive: true })
  const destination = path.join(COVERS_DIR, fileName)
  // Skip the write when we already hold identical bytes.
  await fs.access(destination).catch(() => fs.writeFile(destination, bytes))

  return fileName
}

function extensionFor(response: Response): string | undefined {
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim()
  return EXTENSIONS[contentType.toLowerCase()]
}

/**
 * Fetch an image, re-checking every redirect hop.
 *
 * `redirect: "follow"` is not usable for a user-supplied URL: a perfectly
 * public address is allowed to redirect to 127.0.0.1, and the guard would have
 * inspected only the first link in the chain.
 */
type FetchedImage = { bytes: Buffer; extension: string }

async function fetchImage(
  startUrl: URL,
  options: { allowPrivate: boolean; validateHops: boolean }
): Promise<FetchedImage> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    let url = startUrl

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent(), Accept: "image/*" },
        signal: controller.signal,
        redirect: options.validateHops ? "manual" : "follow",
      })

      if (options.validateHops && response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) throw new CoverError("That address redirected nowhere.")
        url = await assertFetchableUrl(new URL(location, url).toString(), {
          allowPrivate: options.allowPrivate,
        })
        continue
      }

      if (!response.ok) {
        throw new CoverError(`That address returned ${response.status}.`)
      }

      const extension = extensionFor(response)
      if (!extension) {
        throw new CoverError("That link is not a JPEG, PNG, WebP or GIF image.")
      }

      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.byteLength > MAX_COVER_BYTES) {
        throw new CoverError("That image is larger than 5 MB.")
      }
      // Open Library answers "no cover" with a 1x1 placeholder rather than a 404.
      if (bytes.byteLength < 1024) {
        throw new CoverError("That image is too small to be a cover.")
      }

      return { bytes, extension }
    }

    throw new CoverError("That address redirected too many times.")
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Download a provider's cover and keep it on disk.
 *
 * Hotlinking would make every page render depend on Open Library being up and
 * fast, and would leak our readers' browsing to a third party. The returned
 * value is a path relative to the covers directory, stored on the edition and
 * served back through /api/covers.
 *
 * Returns null on any failure — a missing cover is cosmetic and must never
 * block adding a book. The host is one we chose, so no URL guard applies.
 */
export async function cacheCover(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    })
    if (!response.ok) return null

    const extension = extensionFor(response)
    if (!extension) return null

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength < 1024 || bytes.byteLength > MAX_COVER_BYTES) return null

    return await store(bytes, extension)
  } catch {
    return null
  }
}

/**
 * Download a cover from an address the user typed.
 *
 * Unlike `cacheCover` this throws with a reason: the user chose this URL, so
 * "it didn't work" is not a useful answer — they need to know whether the link
 * was wrong, the image too big, or the host off limits.
 */
export async function cacheCoverFromUserUrl(raw: string): Promise<string> {
  const allowPrivate = allowsPrivateCoverUrls()

  let url: URL
  try {
    url = await assertFetchableUrl(raw, { allowPrivate })
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw new CoverError(error.message)
    throw error
  }

  let image: FetchedImage
  try {
    image = await fetchImage(url, { allowPrivate, validateHops: !allowPrivate })
  } catch (error) {
    if (error instanceof CoverError || error instanceof UnsafeUrlError) {
      throw new CoverError(error.message)
    }
    throw new CoverError("That image could not be downloaded.")
  }

  return store(image.bytes, image.extension)
}

/** Delete a cached cover if no other edition still references it. */
export async function deleteCoverIfUnused(
  fileName: string,
  isStillReferenced: (fileName: string) => boolean
): Promise<void> {
  if (isStillReferenced(fileName)) return
  // Reject anything that is not a bare file name — never trust a stored path.
  if (fileName.includes("/") || fileName.includes("..")) return
  await fs.rm(path.join(COVERS_DIR, fileName), { force: true }).catch(() => {})
}
