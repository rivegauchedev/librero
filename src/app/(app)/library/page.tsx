import Link from "next/link"
import { Plus, ScanBarcode } from "lucide-react"

import { requireUser } from "@/lib/auth"
import { listWorks } from "@/db/queries/works"
import { Button } from "@/components/ui/button"
import { LibraryView } from "./components/library-view"

export const metadata = { title: "My books — Librero" }

export default async function LibraryPage() {
  await requireUser()
  const works = listWorks()

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My books</h1>
          <p className="text-muted-foreground">
            {works.length} {works.length === 1 ? "book" : "books"} on the shelf.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/library/new">
              <Plus />
              Add by hand
            </Link>
          </Button>
          <Button asChild>
            <Link href="/search">
              <ScanBarcode />
              Scan or search
            </Link>
          </Button>
        </div>
      </div>

      {works.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p className="font-medium">Nothing here yet</p>
          <p className="text-muted-foreground text-sm">
            Scan the barcode on the back of a book to add it in one tap.
          </p>
          <Button asChild size="sm">
            <Link href="/search">
              <ScanBarcode />
              Scan a book
            </Link>
          </Button>
        </div>
      ) : (
        <LibraryView works={works} />
      )}
    </div>
  )
}
