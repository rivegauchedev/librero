import "server-only"

import fs from "node:fs/promises"
import path from "node:path"

import type { FileFormat } from "@/db/schema"
import { BOOKS_DIR, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/paths"

export class UploadError extends Error {}

/**
 * Extension alone is a claim, not a fact. Each accepted format is confirmed by
 * its magic bytes so a renamed executable cannot land in the uploads directory.
 */
const SIGNATURES: { format: FileFormat; extensions: string[]; matches: (bytes: Buffer) => boolean }[] = [
  {
    // EPUB and CBZ are both ZIP containers.
    format: "epub",
    extensions: [".epub"],
    matches: (bytes) => bytes.subarray(0, 2).toString("latin1") === "PK",
  },
  {
    format: "cbz",
    extensions: [".cbz"],
    matches: (bytes) => bytes.subarray(0, 2).toString("latin1") === "PK",
  },
  {
    format: "pdf",
    extensions: [".pdf"],
    matches: (bytes) => bytes.subarray(0, 5).toString("latin1") === "%PDF-",
  },
  {
    // MOBI/AZW keep their type marker at offset 60.
    format: "mobi",
    extensions: [".mobi", ".prc", ".azw"],
    matches: (bytes) => bytes.subarray(60, 68).toString("latin1") === "BOOKMOBI",
  },
  {
    // AZW3 is a Palm database whose type marker is TPZ3 or BOOKMOBI.
    format: "azw3",
    extensions: [".azw3"],
    matches: (bytes) => {
      const marker = bytes.subarray(60, 68).toString("latin1")
      return marker === "BOOKMOBI" || marker.startsWith("TPZ")
    },
  },
]

/** Strip anything that could steer the write outside the intended directory. */
export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "_").trim()
  const trimmed = base.slice(0, 120)
  return trimmed || "book"
}

export type StoredUpload = {
  fileName: string
  /** Relative to UPLOADS_DIR, which is what gets persisted. */
  filePath: string
  fileSizeBytes: number
  fileFormat: FileFormat
}

export async function storeEbook(file: File, copyId: number): Promise<StoredUpload> {
  if (file.size === 0) throw new UploadError("That file is empty.")
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`Files must be ${MAX_UPLOAD_MB} MB or smaller.`)
  }

  const fileName = sanitizeFileName(file.name)
  const extension = path.extname(fileName).toLowerCase()
  const bytes = Buffer.from(await file.arrayBuffer())

  const candidate = SIGNATURES.find((entry) => entry.extensions.includes(extension))
  if (!candidate) {
    throw new UploadError(
      "Unsupported file type. Accepted: EPUB, PDF, MOBI, AZW3, CBZ."
    )
  }
  if (!candidate.matches(bytes)) {
    throw new UploadError(
      `That file does not look like a real ${extension.slice(1).toUpperCase()}.`
    )
  }

  // The path is built entirely from the copy id and a sanitized name — never
  // from anything the client supplies verbatim.
  const directory = path.join(BOOKS_DIR, String(copyId))
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, fileName), bytes)

  return {
    fileName,
    filePath: path.posix.join("books", String(copyId), fileName),
    fileSizeBytes: bytes.byteLength,
    fileFormat: candidate.format,
  }
}

/** Remove a copy's uploads directory. Safe to call when nothing was uploaded. */
export async function deleteCopyFiles(copyId: number): Promise<void> {
  await fs
    .rm(path.join(BOOKS_DIR, String(copyId)), { recursive: true, force: true })
    .catch(() => {})
}
