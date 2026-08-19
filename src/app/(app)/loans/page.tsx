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
    <div className="flex max-w-[1180px] flex-col gap-6 px-4 lg:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl leading-[1.1] font-medium">Lent out</h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">
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
        <p className="text-muted-foreground bg-card rounded-2xl border border-dashed p-8 text-sm">
          Nothing is lent out. Use &ldquo;Lend&rdquo; next to any copy on a book&rsquo;s
          page.
        </p>
      ) : (
        <OpenLoansTable loans={open} />
      )}

      {returned.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-xl font-medium">Recently returned</h2>
          <ReturnedLoansTable loans={returned} />
        </div>
      ) : null}
    </div>
  )
}
