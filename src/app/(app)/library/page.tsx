import Link from "next/link"
import { Plus, ScanBarcode } from "lucide-react"

import { requireUser } from "@/lib/auth"
import { listWorkLocations, listWorks } from "@/db/queries/works"
import { parseLocation, roomSwatches, shelfKey, shelfLabel, UNSHELVED } from "@/lib/shelves"
import { Button } from "@/components/ui/button"
import { LibraryView, type ShelfGroup } from "./components/library-view"

export const metadata = { title: "The shelves — Librero" }

/**
 * Groups every book by the exact place its copies sit, biggest shelf first. A
 * book with copies in two rooms lands on both rails on purpose: the view is
 * meant to mirror the room, and the book really is in both places.
 */
function shelfGroups(): ShelfGroup[] {
  const byLocation = new Map<string, ShelfGroup>()

  for (const { workId, location } of listWorkLocations()) {
    const parsed = parseLocation(location)
    const key = shelfKey(parsed)
    let group = byLocation.get(key)
    if (!group) {
      group = {
        key,
        room: parsed.room,
        label: shelfLabel(parsed),
        swatch: "",
        workIds: [],
      }
      byLocation.set(key, group)
    }
    group.workIds.push(workId)
  }

  // One map for the whole page, so two rails in the same room agree on colour.
  const swatches = roomSwatches([...byLocation.values()].map((g) => g.room))
  for (const group of byLocation.values()) group.swatch = swatches.get(group.room)!

  return [...byLocation.values()].sort((a, b) =>
    // The unshelved bucket is not a place; it goes last however big it gets.
    a.room === UNSHELVED
      ? 1
      : b.room === UNSHELVED
        ? -1
        : b.workIds.length - a.workIds.length || a.label.localeCompare(b.label)
  )
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>
}) {
  await requireUser()

  const { room } = await searchParams
  const works = listWorks()
  const shelves = shelfGroups()
  // "Not shelved" is a bucket, not a room, so it does not inflate the count.
  const rooms = new Set(
    shelves.map((group) => group.room).filter((room) => room !== UNSHELVED)
  ).size

  return (
    <div className="flex max-w-[1180px] flex-col gap-6 px-4 lg:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.1] font-medium">Your shelves</h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">
            {works.length === 0
              ? "No books yet. The first one is the hard one."
              : rooms === 0
                ? `${works.length} ${works.length === 1 ? "book" : "books"}, none of them placed in a room yet.`
                : `${works.length} ${works.length === 1 ? "book" : "books"} in ${rooms} ${rooms === 1 ? "room" : "rooms"}. Sorted the way they actually sit.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/library/new">
              <Plus />
              Add by hand
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/search">
              <ScanBarcode />
              Scan one in
            </Link>
          </Button>
        </div>
      </div>

      {works.length === 0 ? (
        <div className="bg-card flex flex-col items-start gap-3 rounded-2xl border border-dashed p-8">
          <p className="font-serif text-lg font-medium">Nothing here yet</p>
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
        <LibraryView works={works} shelves={shelves} room={room} />
      )}
    </div>
  )
}
