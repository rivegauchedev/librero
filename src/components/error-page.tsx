import Link from "next/link"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export function ErrorPage({
  code,
  title,
  message,
}: {
  code: string
  title: string
  message: string
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-xl">
        <Logo size={28} />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground font-mono text-sm">{code}</p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
      <Button asChild>
        <Link href="/">Back to your shelf</Link>
      </Button>
    </div>
  )
}
