import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth"
import { Logo } from "@/components/logo"
import { ChangePasswordForm } from "@/app/(app)/settings/account/components/change-password-form"

export const metadata = { title: "Choose a password — Librero" }

/**
 * Sits outside the app shell: someone still holding an admin-issued temporary
 * password gets nowhere else until they replace it.
 */
export default async function FirstRunPage() {
  const user = await requireUser()
  if (!user.mustChangePassword) {
    redirect("/")
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
            <Logo size={22} />
          </div>
          Librero
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Choose your password</h1>
          <p className="text-muted-foreground">
            You are signed in with a temporary password. Pick your own to continue.
          </p>
        </div>
        <ChangePasswordForm redirectOnSuccess="/" />
      </div>
    </div>
  )
}
