import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { SESSION_COOKIE } from "@/lib/session-cookie"

/**
 * First-pass gate only: it checks that a session cookie is *present*, not that
 * it is valid (verifying the JWT needs the secret, and middleware runs on the
 * edge runtime for every request). Real authorization happens in
 * `requireUser()` / `requireAdmin()` on the server.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)
  const isLoginPage = pathname === "/login"

  if (!hasSession && !isLoginPage) {
    const url = new URL("/login", request.url)
    if (pathname !== "/") {
      url.searchParams.set("next", pathname + search)
    }
    return NextResponse.redirect(url)
  }

  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Pages only. API routes do their own session checks and must return JSON
    // or a 401, never an HTML redirect.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
