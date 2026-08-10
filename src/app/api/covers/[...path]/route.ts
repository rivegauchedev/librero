import fs from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

import { getSession } from "@/lib/session"
import { COVERS_DIR } from "@/lib/paths"

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!(await getSession())) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { path: segments } = await params
  const requested = path.resolve(COVERS_DIR, ...segments)

  // Containment check: a crafted path must not escape the covers directory.
  if (requested !== COVERS_DIR && !requested.startsWith(COVERS_DIR + path.sep)) {
    return new NextResponse("Not found", { status: 404 })
  }

  const contentType = CONTENT_TYPES[path.extname(requested).toLowerCase()]
  if (!contentType) return new NextResponse("Not found", { status: 404 })

  try {
    const file = await fs.readFile(requested)
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        // Cover file names are content hashes, so the bytes can never change.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
