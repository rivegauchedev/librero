import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth"
import { SessionProvider } from "@/components/session-provider"
import { AppShell } from "@/components/layouts/app-shell"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  // A temporary password gets you exactly one destination until you replace it.
  if (user.mustChangePassword) {
    redirect("/first-run")
  }

  return (
    <SessionProvider user={user}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  )
}
