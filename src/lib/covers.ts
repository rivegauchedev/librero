import "server-only"

import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import { COVERS_DIR } from "@/lib/paths"
import { userAgent } from "@/lib/providers/http"

const MAX_COVER_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 8000

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

/**
 * Download a cover once and keep it on disk.
 *
 * Hotlinking would make every page render depend on Open Library being up and
 * fast, and would leak our readers' browsing to a third party. The returned
 * value is a path relative to the covers directory, stored on the edition and
 * served back through /api/covers.
 *
 * Returns null on any failure — a missing cover is cosmetic and must never
 * block adding a book.
 */
export async function cacheCover(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent() },
      signal: controller.signal,
      redirect: "follow",
    })
    if (!response.ok) return null

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim()
    const extension = EXTENSIONS[contentType]
    if (!extension) return null

    const bytes = Buffer.from(await response.arrayBuffer())
    // Open Library answers "no cover" with a 1x1 placeholder rather than a 404.
    if (bytes.byteLength < 1024 || bytes.byteLength > MAX_COVER_BYTES) return null

    // Content-addressed: the same cover fetched for two editions is stored once.
    const digest = crypto.createHash("sha1").update(bytes).digest("hex")
    const fileName = `${digest}.${extension}`

    await fs.mkdir(COVERS_DIR, { recursive: true })
    const destination = path.join(COVERS_DIR, fileName)
    // Skip the write when we already hold identical bytes.
    await fs.access(destination).catch(() => fs.writeFile(destination, bytes))

    return fileName
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
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
