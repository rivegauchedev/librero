import { Shield, UserCheck, Users as UsersIcon } from "lucide-react"
import { desc } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { requireAdmin } from "@/lib/auth"
import { StatCards } from "@/components/stat-cards"
import { UsersTable } from "./components/users-table"

export const metadata = { title: "Users — Librero" }

export default async function AdminUsersPage() {
  const admin = await requireAdmin()

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  const admins = rows.filter((row) => row.role === "admin").length
  const neverSignedIn = rows.filter((row) => row.lastLoginAt === null).length

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Everyone here shares one library. Administrators can also manage accounts.
        </p>
      </div>

      <StatCards
        stats={[
          { label: "Accounts", value: rows.length, icon: UsersIcon },
          { label: "Administrators", value: admins, icon: Shield },
          {
            label: "Never signed in",
            value: neverSignedIn,
            icon: UserCheck,
            hint: "Invited but not yet active",
          },
        ]}
      />

      <UsersTable
        users={rows.map((row) => ({
          ...row,
          lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        }))}
        currentUserId={admin.id}
      />
    </div>
  )
}
