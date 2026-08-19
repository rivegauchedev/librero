"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Heart,
  LayoutDashboard,
  Library,
  ScanBarcode,
  Search,
  Settings,
  Upload,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

const PAGES = [
  { title: "Reading room", url: "/", icon: LayoutDashboard },
  { title: "Check a book", url: "/search", icon: ScanBarcode },
  { title: "The shelves", url: "/library", icon: Library },
  { title: "Wanted", url: "/wishlist", icon: Heart },
  { title: "Bring books in", url: "/import", icon: Upload },
  { title: "Settings", url: "/settings/account", icon: Settings },
]

type BookHit = {
  id: number
  title: string
  authors: string
}

export function CommandSearch({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [hits, setHits] = React.useState<BookHit[]>([])

  // Too-short queries are filtered on render rather than by clearing state in
  // the effect — same result, one render fewer, and no stale flash.
  const visibleHits = query.trim().length < 2 ? [] : hits

  // Debounced lookup against the local catalogue — this palette searches books
  // you own, not the metadata providers. Use /search for that.
  React.useEffect(() => {
    if (query.trim().length < 2) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/library-search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal, cache: "no-store" }
        )
        if (response.ok) setHits((await response.json()) as BookHit[])
      } catch {
        // Aborted or offline — leave the previous results in place.
      }
    }, 200)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  const go = (url: string) => {
    onOpenChange(false)
    setQuery("")
    router.push(url)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Jump to a book or a page"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search your books…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>

        {visibleHits.length > 0 ? (
          <>
            <CommandGroup heading="Your books">
              {visibleHits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={`book-${hit.id}`}
                  onSelect={() => go(`/works/${hit.id}`)}
                >
                  <Library />
                  <span className="truncate">{hit.title}</span>
                  {hit.authors ? (
                    <span className="text-muted-foreground ml-auto truncate text-xs">
                      {hit.authors}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Go to">
          {PAGES.filter((page) =>
            page.title.toLowerCase().includes(query.trim().toLowerCase())
          ).map((page) => (
            <CommandItem key={page.url} value={page.url} onSelect={() => go(page.url)}>
              <page.icon />
              {page.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="border-input bg-card hover:bg-accent text-muted-foreground focus-visible:ring-ring relative inline-flex h-8.5 w-full max-w-[300px] items-center justify-start gap-2 rounded-full border px-3.5 pr-12 text-sm whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none"
    >
      <Search className="size-3.5 shrink-0" />
      <span className="truncate">Find anything on your shelves…</span>
      <kbd className="bg-muted pointer-events-none absolute top-1.5 right-2 hidden h-5 items-center rounded-md border px-1.5 font-mono text-[10px] font-medium select-none sm:flex">
        ⌘K
      </kbd>
    </button>
  )
}
