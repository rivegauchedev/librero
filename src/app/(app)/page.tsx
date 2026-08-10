import Link from "next/link"
import { BookMarked, BookOpen, Heart, Library, ScanBarcode } from "lucide-react"

import { requireUser } from "@/lib/auth"
import { getLibraryStats } from "@/db/queries/stats"
import { listCurrentlyReading, listRecentlyAdded } from "@/db/queries/works"
import { BookCard } from "@/components/book-card"
import { StatCards } from "@/components/stat-cards"
import { Button } from "@/components/ui/button"

export default async function OverviewPage() {
  const user = await requireUser()
  const stats = getLibraryStats()
  const recent = listRecentlyAdded(6)
  const reading = listCurrentlyReading()

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hello, {user.displayName.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground">
            {stats.works === 0
              ? "Your shelf is empty. Scan a barcode to add your first book."
              : `${stats.copies} ${stats.copies === 1 ? "copy" : "copies"} across ${stats.works} ${stats.works === 1 ? "book" : "books"}.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/search">
            <ScanBarcode />
            Check a book
          </Link>
        </Button>
      </div>

      <StatCards
        stats={[
          { label: "Books", value: stats.works, icon: Library, hint: `${stats.editions} editions` },
          {
            label: "Copies",
            value: stats.copies,
            icon: BookMarked,
            hint: `${stats.physicalCopies} physical · ${stats.digitalCopies} digital`,
          },
          {
            label: "Unread",
            value: stats.unread,
            icon: BookOpen,
            hint: `${stats.reading} in progress · ${stats.read} finished`,
          },
          { label: "Wishlist", value: stats.wishlist, icon: Heart, hint: "Wanted, not owned" },
        ]}
      />

      {reading.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Currently reading</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {reading.map((work) => (
              <BookCard key={work.id} work={work} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recently added</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/library">See all</Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing here yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {recent.map((work) => (
              <BookCard key={work.id} work={work} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
