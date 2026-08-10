"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { AlertCircle } from "lucide-react"

import { login, type ActionState } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full cursor-pointer" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  )
}

export function LoginForm({
  next,
  className,
  ...props
}: React.ComponentProps<"div"> & { next?: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(login, {})

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your bookshelf</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            {next ? <input type="hidden" name="next" value={next} /> : null}

            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                required
                defaultValue={state.username ?? ""}
                key={state.username ?? ""}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {state.error ? (
              <p
                role="alert"
                className="text-destructive flex items-center gap-2 text-sm"
              >
                <AlertCircle className="size-4 shrink-0" />
                {state.error}
              </p>
            ) : null}

            <SubmitButton />
          </form>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-center text-xs text-balance">
        Accounts are created by an administrator. Ask yours if you need one.
      </p>
    </div>
  )
}
