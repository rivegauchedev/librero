"use client"

import * as React from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { changePassword, type ActionState } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Change password"}
    </Button>
  )
}

export function ChangePasswordForm({
  redirectOnSuccess,
}: {
  /** Set by the first-run screen, which must leave the gate once the password is set. */
  redirectOnSuccess?: string
}) {
  const [state, action] = useActionState<ActionState, FormData>(changePassword, {})
  const formRef = React.useRef<HTMLFormElement>(null)
  const router = useRouter()

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
    if (state.success) {
      toast.success(state.success)
      formRef.current?.reset()
      if (redirectOnSuccess) router.replace(redirectOnSuccess)
    }
  }, [state, redirectOnSuccess, router])

  return (
    <Card className="max-w-2xl">
      <form ref={formRef} action={action}>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>At least 10 characters.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="pt-4">
          <SaveButton />
        </CardFooter>
      </form>
    </Card>
  )
}
