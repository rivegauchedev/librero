"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ScanBarcode } from "lucide-react"

/**
 * The overview's hero field. It does not answer anything itself — it hands the
 * query to /search, which owns the lookup, the camera and the verdict. Keeping
 * one implementation of the check means the answer cannot drift between the two
 * places you can start it from.
 */
export function ShelfSearch() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = query.trim()
        router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search")
      }}
      className="flex max-w-[520px] gap-2.5"
    >
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ISBN, title or author"
        inputMode="search"
        aria-label="ISBN, title or author"
        className="h-11 flex-1 rounded-[10px] border border-white/20 bg-white/10 px-3.5 text-[15px] text-inherit placeholder:text-white/55 focus:border-white/40 focus:outline-none"
      />
      <button
        type="submit"
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-[oklch(0.96_0.012_262)] px-4.5 text-sm font-medium text-[oklch(0.3_0.06_278)] transition-opacity hover:opacity-90"
      >
        <ScanBarcode className="size-4" />
        Scan
      </button>
    </form>
  )
}
