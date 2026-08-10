import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { rankSearchResults, scoreDoc } from "@/lib/providers/ranking"
import type { OlSearchDoc } from "@/lib/providers/openlibrary-schema"

const FIXTURES = path.resolve(__dirname, "fixtures")

function docsFrom(name: string): OlSearchDoc[] {
  return JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8")).docs
}

function doc(overrides: Partial<OlSearchDoc>): OlSearchDoc {
  return { title: "Untitled", author_name: ["Someone"], ...overrides }
}

const titles = (docs: OlSearchDoc[]) => docs.map((d) => d.title)

describe("ranking against a real Open Library response", () => {
  // Open Library's own order for this query puts a study guide and
  // The Night Circus above the novel.
  const circe = docsFrom("ol-search-circe.json")

  it("puts the book you actually meant first", () => {
    const ranked = rankSearchResults("circe", circe)
    expect(ranked[0]!.title).toBe("Circe")
    expect(ranked[0]!.author_name).toContain("Madeline Miller")
  })

  it("does not let a merely popular near-miss outrank an exact title", () => {
    const ranked = titles(rankSearchResults("circe", circe))
    // The Night Circus is more widely read than most, but it is not Circe.
    const circeIndex = ranked.indexOf("Circe")
    const circusIndex = ranked.indexOf("The Night Circus")
    if (circusIndex !== -1) expect(circeIndex).toBeLessThan(circusIndex)
  })

  it("keeps summaries and study guides out of the top results", () => {
    const top = titles(rankSearchResults("circe", circe)).slice(0, 5)
    expect(top.some((t) => /summary|study guide/i.test(t ?? ""))).toBe(false)
  })

  it("collapses duplicate work records for the same book", () => {
    const ranked = rankSearchResults("circe", circe)
    const madeline = ranked.filter(
      (d) => d.title === "Circe" && d.author_name?.[0] === "Madeline Miller"
    )
    expect(madeline).toHaveLength(1)
  })

  it("returns a varied list rather than the same book repeatedly", () => {
    // Distinct *books*, not distinct titles: several unrelated works are called
    // "Circe", and collapsing those would be wrong.
    const top = rankSearchResults("circe", circe)
      .slice(0, 5)
      .map((d) => `${d.title}|${d.author_name?.[0] ?? ""}`)
    expect(new Set(top).size).toBe(top.length)
  })
})

describe("scoreDoc", () => {
  it("rates an exact title match above a partial one", () => {
    const exact = scoreDoc("circe", doc({ title: "Circe" }))
    const partial = scoreDoc("circe", doc({ title: "Circe's Palace" }))
    expect(exact.score).toBeGreaterThan(partial.score)
  })

  it("rewards naming the author", () => {
    const withAuthor = scoreDoc(
      "circe madeline miller",
      doc({ title: "Circe", author_name: ["Madeline Miller"] })
    )
    const withoutAuthor = scoreDoc(
      "circe madeline miller",
      doc({ title: "Circe", author_name: ["Anne De Courcy"] })
    )
    expect(withAuthor.score).toBeGreaterThan(withoutAuthor.score)
  })

  it("penalises companion volumes", () => {
    const novel = scoreDoc("circe", doc({ title: "Circe" }))
    const guide = scoreDoc(
      "circe",
      doc({ title: "Summary of Circe by Madeline Miller", author_name: ["BookHabits"] })
    )
    expect(guide.score).toBeLessThan(novel.score)
  })

  it("reports zero relevance when nothing in the query matches", () => {
    const unrelated = scoreDoc("circe", doc({ title: "Jane Eyre", author_name: ["Brontë"] }))
    expect(unrelated.relevance).toBe(0)
  })
})

describe("relevance floor", () => {
  const query = "circe madeline miller"

  it("drops results that match nothing in the query", () => {
    const ranked = titles(
      rankSearchResults(query, [
        doc({ title: "Circe", author_name: ["Madeline Miller"], readinglog_count: 1000 }),
        // Popular, and completely unrelated to the query.
        doc({ title: "Jane Eyre", author_name: ["Charlotte Brontë"], readinglog_count: 9000 }),
      ])
    )
    expect(ranked).toEqual(["Circe"])
  })

  it("keeps everything when no result matches, rather than returning nothing", () => {
    // A subject-style query matches no title or author, but the results are
    // still the best on offer.
    const ranked = rankSearchResults("science fiction", [
      doc({ title: "Neuromancer", author_name: ["William Gibson"], readinglog_count: 500 }),
      doc({ title: "Solaris", author_name: ["Stanisław Lem"], readinglog_count: 200 }),
    ])
    expect(titles(ranked)).toEqual(["Neuromancer", "Solaris"])
  })
})

describe("dedupe", () => {
  it("keeps the record with an ISBN when scores tie", () => {
    const ranked = rankSearchResults("circe", [
      doc({ title: "Circe", author_name: ["Madeline Miller"] }),
      doc({ title: "Circe", author_name: ["Madeline Miller"], isbn: ["9781408890080"] }),
    ])
    expect(ranked).toHaveLength(1)
    expect(ranked[0]!.isbn).toEqual(["9781408890080"])
  })

  it("does not merge different books that share a title", () => {
    const ranked = rankSearchResults("circe", [
      doc({ title: "Circe", author_name: ["Madeline Miller"] }),
      doc({ title: "Circe", author_name: ["Anne De Courcy"] }),
    ])
    expect(ranked).toHaveLength(2)
  })
})
