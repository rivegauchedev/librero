import { describe, expect, it } from "vitest"

import {
  parseLocation,
  roomKey,
  roomSwatches,
  shelfKey,
  shelfLabel,
  UNSHELVED,
} from "@/lib/shelves"

/*
 * Rooms are read back out of free text, so the parsing rule is the whole
 * contract between what someone typed into a copy's location and what the
 * sidebar and the shelves view show them.
 */
describe("parseLocation", () => {
  it("splits a room from a shelf on the first slash", () => {
    expect(parseLocation("Study / shelf 1")).toEqual({
      room: "Study",
      shelf: "shelf 1",
      raw: "Study / shelf 1",
    })
  })

  it("accepts a comma or a middot as the separator", () => {
    expect(parseLocation("Living room, shelf 2").room).toBe("Living room")
    expect(parseLocation("Living room, shelf 2").shelf).toBe("shelf 2")
    expect(parseLocation("Bedroom · nightstand").shelf).toBe("nightstand")
  })

  it("treats a location with no separator as a room on its own", () => {
    expect(parseLocation("Kindle")).toEqual({
      room: "Kindle",
      shelf: null,
      raw: "Kindle",
    })
  })

  it("only splits on the first separator, so shelves may contain more", () => {
    expect(parseLocation("Study / shelf 1, row B").shelf).toBe("shelf 1, row B")
  })

  it("buckets missing, empty and whitespace-only locations together", () => {
    for (const value of [null, undefined, "", "   "]) {
      expect(parseLocation(value).room).toBe(UNSHELVED)
      expect(parseLocation(value).shelf).toBeNull()
    }
  })

  it("falls back to the bucket when only a shelf was given", () => {
    expect(parseLocation("/ shelf 3").room).toBe(UNSHELVED)
    expect(parseLocation("/ shelf 3").shelf).toBe("shelf 3")
  })

  it("drops a trailing separator rather than inventing an empty shelf", () => {
    expect(parseLocation("Study /").shelf).toBeNull()
  })
})

/*
 * Drawn from a real catalogue: the same shelf written three ways over several
 * years. Grouping on the raw string split it into three identical-looking
 * rails, which is the bug these keys exist to prevent.
 */
describe("shelfKey", () => {
  it("treats spacing around the separator as noise", () => {
    const spellings = ["Stairs / C2", "Stairs/ C2", "Stairs/C2", "Stairs  /  C2"]
    const keys = new Set(spellings.map((l) => shelfKey(parseLocation(l))))
    expect(keys.size).toBe(1)
  })

  it("ignores case and surrounding whitespace", () => {
    expect(shelfKey(parseLocation("  office / b4 "))).toBe(
      shelfKey(parseLocation("Office / B4"))
    )
  })

  it("collapses runs of whitespace inside a name", () => {
    expect(shelfKey(parseLocation("Living  room / A1"))).toBe(
      shelfKey(parseLocation("Living room / A1"))
    )
  })

  it("keeps genuinely different shelves apart", () => {
    const distinct = [
      "Office / B4",
      "Office / B3",
      "Stairs / B4",
      "Office",
      "Staits / E4", // a typo is a different shelf; only the owner can merge it
    ]
    expect(new Set(distinct.map((l) => shelfKey(parseLocation(l)))).size).toBe(
      distinct.length
    )
  })

  it("does not let a room named like a shelf collide with a room+shelf", () => {
    // "a / b" must not key the same as a room literally called "a b".
    expect(shelfKey(parseLocation("a / b"))).not.toBe(shelfKey(parseLocation("a b")))
  })

  it("gives every unlocated book the same key", () => {
    const keys = [null, undefined, "", "   "].map((l) => shelfKey(parseLocation(l)))
    expect(new Set(keys).size).toBe(1)
  })
})

describe("roomKey", () => {
  it("merges spellings of one room", () => {
    expect(roomKey("Office")).toBe(roomKey("office"))
  })

  it("keeps different rooms apart", () => {
    expect(roomKey("Stairs")).not.toBe(roomKey("Staits"))
  })
})

describe("shelfLabel", () => {
  it("joins a room and shelf with a middot", () => {
    expect(shelfLabel(parseLocation("Study / shelf 1"))).toBe("Study · shelf 1")
  })

  it("reads the same however the separator was spaced", () => {
    for (const spelling of ["Office / B4", "Office/ B4", "Office/B4"]) {
      expect(shelfLabel(parseLocation(spelling))).toBe("Office · B4")
    }
  })

  it("prints a bare room unadorned", () => {
    expect(shelfLabel(parseLocation("Kindle"))).toBe("Kindle")
  })
})

describe("roomSwatches", () => {
  it("gives every room a different colour while the palette lasts", () => {
    // The pair that collided under the old hashing scheme.
    const map = roomSwatches(["Office", "Living room"])
    expect(map.get("Office")).not.toBe(map.get("Living room"))

    const five = ["Office", "Living room", "Study", "Bedroom", "Attic"]
    const assigned = roomSwatches(five)
    // Only the named rooms — the map also carries the unshelved bucket.
    expect(new Set(five.map((room) => assigned.get(room))).size).toBe(five.length)
  })

  it("does not depend on the order the rooms arrive in", () => {
    const a = roomSwatches(["Study", "Office", "Attic"])
    const b = roomSwatches(["Attic", "Study", "Office"])
    for (const room of ["Study", "Office", "Attic"]) {
      expect(a.get(room)).toBe(b.get(room))
    }
  })

  it("ignores duplicates rather than burning a colour on each", () => {
    const map = roomSwatches(["Office", "Office", "Study"])
    expect(map.get("Office")).not.toBe(map.get("Study"))
    expect(map.get("Office")).toBe(roomSwatches(["Office", "Study"]).get("Office"))
  })

  it("stays inside the theme's chart ramp for real rooms", () => {
    const map = roomSwatches(["Office", "Living room", "Study"])
    for (const room of ["Office", "Living room", "Study"]) {
      expect(map.get(room)).toMatch(/^var\(--chart-[1-5]\)$/)
    }
  })

  it("repeats the palette past five rooms rather than running out", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g"]
    const map = roomSwatches(many)
    expect(map.size).toBe(many.length + 1) // + the unshelved bucket
    expect(map.get("f")).toBe(map.get("a"))
  })

  it("gives the unshelved bucket a neutral, non-room colour", () => {
    const map = roomSwatches(["Office", UNSHELVED])
    expect(map.get(UNSHELVED)).toBe("var(--muted-foreground)")
    expect(map.get(UNSHELVED)).not.toBe(map.get("Office"))
  })
})
