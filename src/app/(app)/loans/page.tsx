import Link from "next/link"
import { Library } from "lucide-react"

import { requireUser } from "@/lib/auth"
import { listOpenLoans, listRecentlyReturned } from "@/db/queries/loans"
import { Button } from "@/components/ui/button"
import { OpenLoansTable, ReturnedLoansTable } from "./components/loans-view"

export const metadata = { title: "On loan — Librero" }

export default async function LoansPage() {
  await requireUser()
  const open = listOpenLoans()
  const returned = listRecentlyReturned(10)

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">On loan</h1>
          <p className="text-muted-foreground">
            Books that are out of the house, and who has them.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/library">
            <Library />
            My books
          </Link>
        </Button>
      </div>

      {open.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-sm">
          Nothing is lent out. Use &ldquo;Lend&rdquo; next to any copy on a book&rsquo;s
          page.
        </p>
      ) : (
        <OpenLoansTable loans={open} />
      )}

      {returned.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Recently returned</h2>
          <ReturnedLoansTable loans={returned} />
        </div>
      ) : null}
    </div>
  )
}
