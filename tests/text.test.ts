import { describe, expect, it } from "vitest"

import {
  toAuthorMatchKey,
  toFtsQuery,
  toSortName,
  toSortTitle,
  toTitleMatchKey,
} from "@/lib/text"

describe("toSortTitle", () => {
  it("drops the leading article", () => {
    expect(toSortTitle("The Left Hand of Darkness")).toBe("Left Hand of Darkness")
    expect(toSortTitle("El Aleph")).toBe("Aleph")
    expect(toSortTitle("Dune")).toBe("Dune")
  })
})

describe("toTitleMatchKey", () => {
  it("collapses the variations that describe the same book", () => {
    const key = toTitleMatchKey("Dune")
    expect(toTitleMatchKey("DUNE")).toBe(key)
    expect(toTitleMatchKey("Dune: Special Edition")).toBe(key)
    expect(toTitleMatchKey("  Dune  ")).toBe(key)
  })

  it("folds diacritics and punctuation", () => {
    expect(toTitleMatchKey("Cien años de soledad")).toBe("cien anos de soledad")
    expect(toTitleMatchKey("Slaughterhouse-Five!")).toBe("slaughterhouse five")
  })

  it("keeps genuinely different titles apart", () => {
    expect(toTitleMatchKey("Dune")).not.toBe(toTitleMatchKey("Dune Messiah"))
  })
})

describe("toAuthorMatchKey", () => {
  it("keys on the surname in either name order", () => {
    expect(toAuthorMatchKey("Ursula K. Le Guin")).toBe("guin")
    expect(toAuthorMatchKey("Le Guin, Ursula K.")).toBe("le guin")
    expect(toAuthorMatchKey("Frank Herbert")).toBe("herbert")
  })

  it("folds diacritics", () => {
    expect(toAuthorMatchKey("Gabriel García Márquez")).toBe("marquez")
  })
})

describe("toSortName", () => {
  it("puts the surname first", () => {
    expect(toSortName("Ursula K. Le Guin")).toBe("Guin, Ursula K. Le")
    expect(toSortName("Le Guin, Ursula K.")).toBe("Le Guin, Ursula K.")
    expect(toSortName("Homer")).toBe("Homer")
  })
})

describe("toFtsQuery", () => {
  it("builds a prefix-matched AND of the terms", () => {
    expect(toFtsQuery("dune herbert")).toBe('"dune"* AND "herbert"*')
  })

  it("strips the characters FTS5 would treat as operators", () => {
    expect(toFtsQuery('dune OR "x" -y')).toBe('"dune"* AND "or"* AND "x"* AND "y"*')
    expect(toFtsQuery("   ")).toBe("")
  })
})
