"use server"

import { redirect } from "next/navigation"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { users } from "@/db/schema"
import { verifyPassword, hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password"
import { clearSessionCookie, setSessionCookie } from "@/lib/session"
import { assertUser } from "@/lib/auth"

export type ActionState = {
  error?: string
  success?: string
  /** Echoed back so a failed sign-in does not clear what was typed. */
  username?: string
}

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
  // FormData.get returns null for a field that is not on the form, and the
  // hidden "next" input only exists when the user was redirected here.
  next: z.string().nullish(),
})

export async function login(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    next: formData.get("next"),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid credentials",
      username: String(formData.get("username") ?? ""),
    }
  }

  const { username, password, next } = parsed.data

  const user = await db.query.users.findFirst({
    where: sql`lower(${users.username}) = ${username.toLowerCase()}`,
  })

  // Same message either way: never reveal whether a username exists.
  const invalid = { error: "Incorrect username or password.", username }
  if (!user) {
    // Spend comparable time on a missing user so timing doesn't leak existence.
    await hashPassword(password)
    return invalid
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    return invalid
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id))

  await setSessionCookie({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  })

  // Only ever bounce to a path on this app — never an attacker-supplied origin.
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/"
  redirect(destination)
}

export async function logout(): Promise<void> {
  await clearSessionCookie()
  redirect("/login")
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The new passwords do not match",
    path: ["confirmPassword"],
  })

export async function changePassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await assertUser()

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.id) })
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return { error: "Your current password is incorrect." }
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  // Reissue the cookie so the "must change password" gate lifts immediately.
  await setSessionCookie({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: false,
  })

  return { success: "Password updated." }
}
