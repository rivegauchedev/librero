import { describe, expect, it } from "vitest"

import {
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
  isbn13To10,
  looksLikeIsbn,
  normalizeIsbn,
  parseIsbn,
} from "@/lib/isbn"

describe("normalizeIsbn", () => {
  it("strips hyphens and spaces and upcases the check digit", () => {
    expect(normalizeIsbn("0-441-01359-7")).toBe("0441013597")
    expect(normalizeIsbn("043942089 x")).toBe("043942089X")
  })
})

describe("checksums", () => {
  it("accepts valid ISBNs", () => {
    expect(isValidIsbn10("0441013597")).toBe(true)
    expect(isValidIsbn10("043942089X")).toBe(true) // X check digit
    expect(isValidIsbn13("9780441013593")).toBe(true)
  })

  it("rejects transposed digits — the classic barcode misread", () => {
    expect(isValidIsbn10("0441013579")).toBe(false)
    expect(isValidIsbn13("9780441013539")).toBe(false)
  })

  it("rejects the wrong length outright", () => {
    expect(isValidIsbn10("044101359")).toBe(false)
    expect(isValidIsbn13("978044101359")).toBe(false)
  })
})

describe("conversion", () => {
  it("round-trips between the two forms", () => {
    expect(isbn10To13("0441013597")).toBe("9780441013593")
    expect(isbn13To10("9780441013593")).toBe("0441013597")
    expect(isbn13To10(isbn10To13("043942089X")!)).toBe("043942089X")
  })

  it("refuses to invent an ISBN-10 for a 979 prefix", () => {
    // 979-prefixed ISBN-13s have no ISBN-10 equivalent.
    expect(isbn13To10("9791234567896")).toBeNull()
  })
})

describe("parseIsbn", () => {
  it("returns both forms whichever was given", () => {
    expect(parseIsbn("978-0-441-01359-3")).toEqual({
      isbn13: "9780441013593",
      isbn10: "0441013597",
    })
    expect(parseIsbn("0441013597")).toEqual({
      isbn13: "9780441013593",
      isbn10: "0441013597",
    })
  })

  it("returns null for a checksum failure rather than guessing", () => {
    expect(parseIsbn("9780441013539")).toBeNull()
    expect(parseIsbn("dune")).toBeNull()
  })
})

describe("looksLikeIsbn", () => {
  it("distinguishes a scanned number from a typed title", () => {
    expect(looksLikeIsbn("978-0-441-01359-3")).toBe(true)
    expect(looksLikeIsbn("0441013597")).toBe(true)
    // Shape only: the checksum is parseIsbn's job.
    expect(looksLikeIsbn("9780441013539")).toBe(true)
    expect(looksLikeIsbn("Dune")).toBe(false)
    expect(looksLikeIsbn("1984")).toBe(false)
  })
})
