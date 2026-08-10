import { NextResponse } from "next/server"

import { exportRows } from "@/db/queries/export"
import { toCsv } from "@/lib/csv"
import { getSession } from "@/lib/session"

/** One row per copy, in Librero's own dialect — re-importable without loss. */
export async function GET() {
  if (!(await getSession())) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const csv = toCsv(exportRows())
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="librero-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
