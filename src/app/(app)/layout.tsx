import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth"
import { getNavCounts } from "@/db/queries/stats"
import { listWorkLocations } from "@/db/queries/works"
import { parseLocation, roomKey, roomSwatches, UNSHELVED } from "@/lib/shelves"
import { SessionProvider } from "@/components/session-provider"
import { AppShell } from "@/components/layouts/app-shell"
import type { Room } from "@/components/nav-rooms"

/**
 * Rooms are the distinct first segments of every copy's location, biggest
 * first. Books with no location collapse into one "Not shelved" room rather
 * than vanishing — an unlocated book is still a book you own.
 *
 * The count is books, not copies, and comes from the same query the shelves
 * view groups by. Counting copies here instead would put a different number
 * beside "Study" than the rail below it shows, for no reason a reader could
 * work out. A book in two rooms is counted in both, exactly as it is drawn.
 */
function roomsFromLocations(): Room[] {
  // Keyed case-insensitively, but displayed with the spelling first seen —
  // "Office" and "office" are one room, and it should be named once.
  const worksByRoom = new Map<string, { name: string; works: Set<number> }>()
  for (const { workId, location } of listWorkLocations()) {
    const { room } = parseLocation(location)
    const key = roomKey(room)
    const entry = worksByRoom.get(key)
    if (entry) entry.works.add(workId)
    else worksByRoom.set(key, { name: room, works: new Set([workId]) })
  }
  const byRoom = new Map(
    [...worksByRoom.values()].map((entry) => [entry.name, entry.works.size] as const)
  )

  const swatches = roomSwatches(byRoom.keys())

  return [...byRoom.entries()]
    .map(([name, books]) => ({ name, books, swatch: swatches.get(name)! }))
    .sort((a, b) =>
      // "Not shelved" is a bucket, not a room — it sits at the bottom.
      a.name === UNSHELVED
        ? 1
        : b.name === UNSHELVED
          ? -1
          : b.books - a.books || a.name.localeCompare(b.name)
    )
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  // A temporary password gets you exactly one destination until you replace it.
  if (user.mustChangePassword) {
    redirect("/first-run")
  }

  return (
    <SessionProvider user={user}>
      <AppShell counts={getNavCounts()} rooms={roomsFromLocations()}>
        {children}
      </AppShell>
    </SessionProvider>
  )
}
