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
    <div className="flex max-w-[1180px] flex-col gap-6 px-4 lg:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl leading-[1.1] font-medium">Wanted</h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">
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
        <p className="text-muted-foreground bg-card rounded-2xl border border-dashed p-8 text-sm">
          Nothing on the wishlist. Add one from the check screen — the &ldquo;Wishlist&rdquo;
          button next to any result.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {works.map((work) => (
            <BookCard key={work.id} work={work} />
          ))}
        </div>
      )}
    </div>
  )
}
