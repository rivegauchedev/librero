import Link from "next/link"
import { ScanBarcode } from "lucide-react"

import { requireUser } from "@/lib/auth"
import { listWishlist } from "@/db/queries/works"
import { BookCard } from "@/components/book-card"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Wishlist — Librero" }

export default async function WishlistPage() {
  await requireUser()
  const works = listWishlist()

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wishlist</h1>
          <p className="text-muted-foreground">
            Books you want but do not own. Scanning one in a shop says so.
          </p>
        </div>
        <Button asChild>
          <Link href="/search">
            <ScanBarcode />
            Scan or search
          </Link>
        </Button>
      </div>

      {works.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-sm">
          Nothing on the wishlist. Add one from the check screen — the &ldquo;Wishlist&rdquo;
          button next to any result.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
          {works.map((work) => (
            <BookCard key={work.id} work={work} />
          ))}
        </div>
      )}
    </div>
  )
}
