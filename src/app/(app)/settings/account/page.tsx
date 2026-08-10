import { requireUser } from "@/lib/auth"
import { ChangePasswordForm } from "./components/change-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = { title: "Account — Librero" }

export default async function AccountSettings() {
  const user = await requireUser()

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">Your sign-in details.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Usernames and display names are managed by an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">Username</p>
            <p className="font-medium">{user.username}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Display name</p>
            <p className="font-medium">{user.displayName}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Role</p>
            <p className="font-medium">
              {user.role === "admin" ? "Administrator" : "User"}
            </p>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordForm />
    </div>
  )
}
