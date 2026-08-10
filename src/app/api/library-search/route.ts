import { NextResponse } from "next/server"

import { getSession } from "@/lib/session"
import { searchLibrary } from "@/db/queries/search"

/** Backs the ⌘K palette: fast, local, owned-books-only. */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Never cached: the catalogue changes under the same URL.
  const headers = { "Cache-Control": "no-store" }

  const query = new URL(request.url).searchParams.get("q") ?? ""
  if (query.trim().length < 2) return NextResponse.json([], { headers })

  const results = searchLibrary(query, 8).map((work) => ({
    id: work.id,
    title: work.title,
    authors: work.authors,
  }))

  return NextResponse.json(results, { headers })
}
