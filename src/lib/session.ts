import "server-only"

import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import type { SessionUser } from "@/lib/session-types"
import { SESSION_COOKIE } from "@/lib/session-cookie"

export { SESSION_COOKIE }

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short — set a random string of at least 32 characters."
    )
  }
  return new TextEncoder().encode(value)
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] })
    const id = Number(payload.sub)
    const { username, displayName, role, mustChangePassword } = payload
    if (
      !Number.isInteger(id) ||
      typeof username !== "string" ||
      typeof displayName !== "string" ||
      (role !== "admin" && role !== "user")
    ) {
      return null
    }
    return {
      id,
      username,
      displayName,
      role,
      mustChangePassword: mustChangePassword === true,
    }
  } catch {
    return null
  }
}

/** Read the current session, or null when signed out. Never throws on a bad cookie. */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return token ? verifySessionToken(token) : null
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user)
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function clearSessionCookie(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}
