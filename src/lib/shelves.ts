/*
 * A copy's location is free text — "Study / shelf 1", "Living room, shelf 2",
 * "Kindle". The redesign wants to group the library by room and to draw each
 * shelf as its own rail, so we read that structure back out of the string
 * rather than making people re-enter it into a rooms table they never asked
 * for. The rule is deliberately shallow: the part before the first slash or
 * comma is the room, whatever follows is the shelf.
 */

export type Shelf = {
  /** "Study" — the grouping the sidebar lists. */
  room: string
  /** "shelf 1", or null when the location names only a room. */
  shelf: string | null
  /** The original string, for display where the full location is wanted. */
  raw: string
}

/** Copies with no location at all land here, so nothing silently disappears. */
export const UNSHELVED = "Not shelved"

/** Collapses runs of whitespace so "Living  room" and "Living room" are one. */
function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function parseLocation(location: string | null | undefined): Shelf {
  const raw = tidy(location ?? "")
  if (!raw) return { room: UNSHELVED, shelf: null, raw: "" }

  const split = raw.search(/[/,·]/)
  if (split === -1) return { room: raw, shelf: null, raw }

  const room = tidy(raw.slice(0, split))
  const shelf = tidy(raw.slice(split + 1))
  return {
    room: room || UNSHELVED,
    shelf: shelf || null,
    raw,
  }
}

/*
 * Identity for grouping, which is not the same thing as the raw string.
 *
 * A catalogue written by hand over years contains "Stairs / C2", "Stairs/ C2"
 * and "Stairs/C2" — one shelf, three spellings. Grouping on the raw text draws
 * that shelf as three separate rails carrying identical headings, which reads
 * as a bug because it is one. Case and spacing are noise here; the room and the
 * shelf are the shelf.
 */
export function shelfKey(shelf: Shelf): string {
  // NUL cannot occur in either half, so it cannot merge two distinct shelves.
  return `${shelf.room.toLowerCase()}\u0000${(shelf.shelf ?? "").toLowerCase()}`
}

/** Identity for a room alone, on the same case-insensitive footing. */
export function roomKey(room: string): string {
  return room.toLowerCase()
}

/** "Study · shelf 1" — the heading the shelf rail sits under. */
export function shelfLabel(shelf: Shelf): string {
  return shelf.shelf ? `${shelf.room} · ${shelf.shelf}` : shelf.room
}

/*
 * Rooms get a colour so the sidebar swatch and the shelf heading agree. The
 * palette is the theme's chart ramp, so rooms stay inside the design system and
 * follow it into dark mode.
 *
 * Colours are assigned by position in the sorted room list rather than by
 * hashing the name: hashing is stable per-room but collides readily, and two
 * rooms sharing a colour defeats the only job the swatch has. Sorting first
 * means the assignment is deterministic, and adding a room only disturbs the
 * colours of rooms that sort after it.
 */
const ROOM_SWATCHES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

/**
 * Maps every room to a swatch in one pass. Build it once from the full set of
 * rooms — calling it per room would give each a palette of one.
 *
 * Past five rooms the palette repeats; the swatch is a hint next to a name that
 * is already written out, not the only thing telling them apart.
 */
export function roomSwatches(rooms: Iterable<string>): Map<string, string> {
  const named = [...new Set(rooms)].filter((room) => room !== UNSHELVED).sort()
  const map = new Map<string, string>(
    named.map((room, index) => [room, ROOM_SWATCHES[index % ROOM_SWATCHES.length]!])
  )
  // The unshelved bucket is not a place, so it gets no colour of its own.
  map.set(UNSHELVED, "var(--muted-foreground)")
  return map
}
