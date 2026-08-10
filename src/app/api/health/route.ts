import { NextResponse } from "next/server"

import { sqlite } from "@/db"

/**
 * Unauthenticated on purpose: the container healthcheck has no session. It
 * reveals nothing beyond "the process is up and the database answers".
 */
export async function GET() {
  try {
    sqlite.prepare("SELECT 1").get()
    return NextResponse.json({ status: "ok" })
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 })
  }
}
