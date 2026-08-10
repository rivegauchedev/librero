"use server"

import { revalidatePath } from "next/cache"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { users } from "@/db/schema"
import { assertAdmin, AuthorizationError } from "@/lib/auth"
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password"
import { ROLES } from "@/db/schema"

export type UserActionState = { error?: string; success?: string }

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Usernames need at least 3 characters")
  .max(32, "Usernames are limited to 32 characters")
  .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores")

const createUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Enter a display name").max(64),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
  role: z.enum(ROLES),
})

function toMessage(error: unknown): string {
  if (error instanceof AuthorizationError) return error.message
  if (error instanceof Error && error.message.includes("UNIQUE")) {
    return "That username is already taken."
  }
  return "Something went wrong. Please try again."
}

export async function createUser(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  try {
    await assertAdmin()

    const parsed = createUserSchema.safeParse({
      username: formData.get("username"),
      displayName: formData.get("displayName"),
      password: formData.get("password"),
      role: formData.get("role"),
    })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }

    await db.insert(users).values({
      username: parsed.data.username,
      displayName: parsed.data.displayName,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      // Admin-set passwords are temporary by definition.
      mustChangePassword: true,
    })

    revalidatePath("/admin/users")
    return { success: `Created ${parsed.data.username}.` }
  } catch (error) {
    return { error: toMessage(error) }
  }
}

const resetPasswordSchema = z.object({
  userId: z.coerce.number().int().positive(),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
})

export async function resetUserPassword(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  try {
    await assertAdmin()

    const parsed = resetPasswordSchema.safeParse({
      userId: formData.get("userId"),
      password: formData.get("password"),
    })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }

    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(parsed.data.password),
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, parsed.data.userId))

    revalidatePath("/admin/users")
    return { success: "Password reset. They will be asked to change it." }
  } catch (error) {
    return { error: toMessage(error) }
  }
}

const changeRoleSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(ROLES),
})

export async function changeUserRole(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  try {
    const admin = await assertAdmin()

    const parsed = changeRoleSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
    })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }

    if (parsed.data.userId === admin.id && parsed.data.role !== "admin") {
      return { error: "You cannot remove your own admin role." }
    }
    if (parsed.data.role !== "admin" && (await countAdmins()) <= 1) {
      return { error: "There must always be at least one administrator." }
    }

    await db
      .update(users)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(eq(users.id, parsed.data.userId))

    revalidatePath("/admin/users")
    return { success: "Role updated." }
  } catch (error) {
    return { error: toMessage(error) }
  }
}

export async function deleteUser(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  try {
    const admin = await assertAdmin()
    const userId = Number(formData.get("userId"))

    if (!Number.isInteger(userId) || userId <= 0) {
      return { error: "Invalid user." }
    }
    if (userId === admin.id) {
      return { error: "You cannot delete your own account." }
    }

    const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!target) return { error: "That user no longer exists." }
    if (target.role === "admin" && (await countAdmins()) <= 1) {
      return { error: "There must always be at least one administrator." }
    }

    await db.delete(users).where(eq(users.id, userId))

    revalidatePath("/admin/users")
    return { success: `Deleted ${target.username}.` }
  } catch (error) {
    return { error: toMessage(error) }
  }
}

async function countAdmins(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "admin"))
  return row?.count ?? 0
}
