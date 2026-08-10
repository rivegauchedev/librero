import "server-only"

import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import type { SessionUser } from "@/lib/session-types"

/**
 * Guard for anything behind the login wall. Call this at the top of every
 * protected page, route handler and Server Action — the middleware redirect and
 * the hidden sidebar links are conveniences, not the security boundary.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) {
    redirect("/login")
  }
  return user
}

/** Guard for admin-only operations: user management. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== "admin") {
    redirect("/errors/forbidden")
  }
  return user
}

/** Server Action variant: throws instead of redirecting, so the form can show the error. */
export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message)
    this.name = "AuthorizationError"
  }
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new AuthorizationError("You are signed out.")
  if (user.role !== "admin") throw new AuthorizationError()
  return user
}

export async function assertUser(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new AuthorizationError("You are signed out.")
  return user
}
