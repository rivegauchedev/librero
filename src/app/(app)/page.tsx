import Link from "next/link"

import { requireUser } from "@/lib/auth"
import { getLibraryStats } from "@/db/queries/stats"
import { listCurrentlyReading, listRecentlyAdded } from "@/db/queries/works"
import type { WorkListRow } from "@/db/queries/works"
import { BookCard } from "@/components/book-card"
import { BookCover } from "@/components/book-cover"
import { Shelf } from "@/components/shelf"
import { ShelfSearch } from "@/components/shelf-search"

export const metadata = { title: "Reading room — Librero" }

/** Server-side, so the greeting never flips between render and hydration. */
function greeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/*
 * "268 books, three of them half-read. No judgement." The line only earns the
 * joke when there is something to be sheepish about, so the tail is dropped
 * when nothing is in progress — and the empty shelf gets its own invitation.
 */
function subtitle(works: number, reading: number) {
  if (works === 0) return "Nothing on the shelves yet. Scan a barcode and start one."

  const books = `${works} ${works === 1 ? "book" : "books"}`
  if (reading === 0) return `${books}, none of them open. A clean slate.`
  return `${books}, ${reading === 1 ? "one of them" : `${reading} of them`} half-read. No judgement.`
}

export default async function OverviewPage() {
  const user = await requireUser()
  const stats = getLibraryStats()
  const recent = listRecentlyAdded(8)
  const reading = listCurrentlyReading()

  return (
    <div className="flex max-w-[1180px] flex-col gap-8 px-4 lg:px-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-serif text-4xl leading-[1.1] font-medium tracking-[-0.01em]">
            {greeting(new Date().getHours())}, {user.displayName.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">
            {subtitle(stats.works, stats.reading)}
          </p>
        </div>

        <dl className="bg-muted flex items-center gap-5 rounded-full px-4.5 py-2.5">
          {[
            { value: stats.works, label: "books" },
            { value: stats.copies, label: "copies" },
            { value: stats.unread, label: "unread" },
            { value: stats.wishlist, label: "wanted" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-1.5">
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-serif text-[22px] font-medium tabular-nums">
                {stat.value}
              </dd>
              <span aria-hidden className="text-muted-foreground text-xs">
                {stat.label}
              </span>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr] lg:items-stretch">
        {/* The question the whole app exists to answer, asked first. */}
        <section className="relative overflow-hidden rounded-2xl bg-linear-135 from-[oklch(0.36_0.075_278)] to-[oklch(0.28_0.03_262)] px-7 py-6.5 text-[oklch(0.97_0.009_262)] shadow-[0_12px_30px_-18px_rgb(60_30_10/0.6)]">
          <h2 className="font-serif text-[26px] font-medium">Do you already own it?</h2>
          <p className="mt-1.5 mb-4.5 max-w-[46ch] text-sm opacity-75">
            Point the camera at the barcode. You will know before the shop assistant
            reaches you.
          </p>
          <ShelfSearch />
        </section>

        <section className="bg-card flex flex-col gap-3.5 rounded-2xl border px-6 py-5.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-xl font-medium">On the nightstand</h2>
            <span className="text-muted-foreground text-xs">
              {reading.length} open
            </span>
          </div>

          {reading.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing open. Mark a book as reading and it will wait for you here.
            </p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {reading.slice(0, 4).map((work) => (
                <NightstandRow key={work.id} work={work} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-[22px] font-medium">Just arrived</h2>
          <Link
            href="/library"
            className="text-primary text-[13px] underline underline-offset-[3px]"
          >
            All {stats.works} books
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing here yet.</p>
        ) : (
          <Shelf>
            <div className="grid grid-cols-3 items-end gap-5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {recent.map((work) => (
                <BookCard key={work.id} work={work} />
              ))}
            </div>
          </Shelf>
        )}
      </section>
    </div>
  )
}

/** A book you are part-way through, with the bar only when we can compute one. */
function NightstandRow({ work }: { work: WorkListRow }) {
  const percent =
    work.currentPage && work.pageCount
      ? Math.min(100, Math.round((work.currentPage / work.pageCount) * 100))
      : null

  return (
    <li>
      <Link href={`/works/${work.id}`} className="group flex items-center gap-3">
        <BookCover
          coverPath={work.coverPath}
          title={work.title}
          className="w-[42px] shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-serif truncate text-base leading-tight font-medium group-hover:underline">
            {work.title}
          </p>
          <p className="text-muted-foreground mt-0.5 mb-1.5 truncate text-xs">
            {work.authors}
          </p>
          {percent === null ? (
            <p className="text-muted-foreground/70 text-[11px] italic">
              No page recorded
            </p>
          ) : (
            <div className="bg-muted h-1 overflow-hidden rounded-full">
              <div className="bg-primary h-full" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
        {percent === null ? null : (
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {percent}%
          </span>
        )}
      </Link>
    </li>
  )
}
