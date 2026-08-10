"use server"

import { revalidatePath } from "next/cache"

import { sqlite } from "@/db"
import { assertUser, AuthorizationError } from "@/lib/auth"
import { deleteCopyFiles, storeEbook, UploadError } from "@/lib/uploads"

export type UploadActionState = { error?: string; success?: string }

export async function uploadEbook(
  _prev: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  try {
    await assertUser()

    const copyId = Number(formData.get("copyId"))
    const workId = Number(formData.get("workId"))
    const file = formData.get("file")

    if (!Number.isInteger(copyId) || copyId <= 0) return { error: "Invalid copy." }
    if (!(file instanceof File)) return { error: "Choose a file to upload." }

    const copy = sqlite
      .prepare("SELECT medium, file_path AS filePath FROM copies WHERE id = ?")
      .get(copyId) as { medium: string; filePath: string | null } | undefined

    if (!copy) return { error: "That copy no longer exists." }
    if (copy.medium !== "digital") {
      return { error: "Only digital copies can hold a file." }
    }

    // Replacing a file: clear the old one so the directory does not accumulate.
    if (copy.filePath) await deleteCopyFiles(copyId)

    const stored = await storeEbook(file, copyId)

    sqlite
      .prepare(
        `UPDATE copies SET
           file_name = ?, file_path = ?, file_size_bytes = ?, file_format = ?,
           updated_at = unixepoch()
         WHERE id = ?`
      )
      .run(
        stored.fileName,
        stored.filePath,
        stored.fileSizeBytes,
        stored.fileFormat,
        copyId
      )

    revalidatePath(`/works/${workId}`)
    return { success: `Uploaded ${stored.fileName}.` }
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message }
    if (error instanceof AuthorizationError) return { error: error.message }
    console.error("Upload failed:", error)
    return { error: "The upload failed. Please try again." }
  }
}

export async function deleteEbook(
  _prev: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  try {
    await assertUser()

    const copyId = Number(formData.get("copyId"))
    const workId = Number(formData.get("workId"))
    if (!Number.isInteger(copyId) || copyId <= 0) return { error: "Invalid copy." }

    await deleteCopyFiles(copyId)
    sqlite
      .prepare(
        `UPDATE copies SET file_name = NULL, file_path = NULL, file_size_bytes = NULL,
                           updated_at = unixepoch()
          WHERE id = ?`
      )
      .run(copyId)

    revalidatePath(`/works/${workId}`)
    return { success: "File removed." }
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    return { error: "Could not remove the file." }
  }
}
