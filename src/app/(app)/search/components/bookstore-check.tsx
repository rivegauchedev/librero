"use client"

import * as React from "react"
import { AlertTriangle, Loader2, ScanBarcode, Search } from "lucide-react"

import type { LookupCandidate, LookupResponse } from "@/app/api/lookup/route"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { CandidateCard } from "./candidate-card"
import { ShelfMatchCard } from "./shelf-match-card"

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "results"; response: LookupResponse; query: string }

/**
 * One lookup, returning the state it produces rather than setting it. Keeping
 * the fetch free of setState lets both the submit handler and the arrived-with-
 * a-query effect share it without either of them writing state synchronously.
 */
async function lookup(query: string, signal?: AbortSignal): Promise<State> {
  try {
    // cache: "no-store" as well as the response header — belt and braces on a
    // request whose answer changes the moment you add the book.
    const response = await fetch(`/api/lookup?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      return {
        kind: "error",
        message: body.error ?? "The lookup failed. Please try again.",
      }
    }

    return {
      kind: "results",
      response: (await response.json()) as LookupResponse,
      query,
    }
  } catch {
    return { kind: "error", message: "Could not reach the server." }
  }
}

export function BookstoreCheck({ initialQuery = "" }: { initialQuery?: string }) {
  const seed = initialQuery.trim()

  const [query, setQuery] = React.useState(initialQuery)
  const [scanning, setScanning] = React.useState(false)
  // A query handed over in the URL is already the user's intent, so the first
  // paint is the spinner rather than an empty form that flashes into one.
  const [state, setState] = React.useState<State>(
    seed.length >= 2 ? { kind: "loading" } : { kind: "idle" }
  )
  const requestId = React.useRef(0)

  React.useEffect(() => {
    if (seed.length < 2) return

    const controller = new AbortController()
    const id = ++requestId.current
    void lookup(seed, controller.signal).then((next) => {
      if (id === requestId.current) setState(next)
    })
    return () => controller.abort()
  }, [seed])

  const run = React.useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (trimmed.length < 2) {
      setState({ kind: "idle" })
      return
    }

    // Out-of-order responses would otherwise overwrite a newer result.
    const id = ++requestId.current
    setState({ kind: "loading" })

    const next = await lookup(trimmed)
    if (id === requestId.current) setState(next)
  }, [])

  const onScanned = React.useCallback(
    (isbn: string) => {
      setScanning(false)
      setQuery(isbn)
      void run(isbn)
    },
    [run]
  )

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void run(query)
        }}
        className="flex gap-2.5"
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ISBN, title or author"
          inputMode="search"
          autoFocus
          className="bg-card h-13 rounded-xl px-4 text-[17px] md:text-[17px]"
        />
        <Button
          type="submit"
          disabled={query.trim().length < 2}
          className="h-13 shrink-0 rounded-xl px-5 text-[15px]"
        >
          <Search />
          <span className="sr-only sm:not-sr-only">Check</span>
        </Button>
        <Button
          type="button"
          variant={scanning ? "secondary" : "outline"}
          onClick={() => setScanning((open) => !open)}
          className="h-13 shrink-0 rounded-xl px-5"
        >
          <ScanBarcode />
          <span className="sr-only sm:not-sr-only">{scanning ? "Close" : "Scan"}</span>
        </Button>
      </form>

      {scanning ? (
        <BarcodeScanner onDetected={onScanned} onClose={() => setScanning(false)} />
      ) : null}

      {state.kind === "loading" ? (
        <p className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Looking it up…
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p className="text-destructive flex items-center gap-2 py-4 text-sm">
          <AlertTriangle className="size-4" />
          {state.message}
        </p>
      ) : null}

      {state.kind === "results" ? (
        <Results response={state.response} query={state.query} />
      ) : null}
    </div>
  )
}

function Results({ response, query }: { response: LookupResponse; query: string }) {
  if (response.invalidIsbn) {
    return (
      <EmptyState
        title="That is not a valid ISBN"
        body="The check digit does not match — barcode scanners misread from time to time. Try scanning again, or search by title."
        query={query}
      />
    )
  }

  const shelf = (
    <>
      {response.shelf.map((match) => (
        <ShelfMatchCard key={match.workId} match={match} />
      ))}
    </>
  )

  if (response.candidates.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {shelf}
        {response.providerUnavailable ? (
          <EmptyState
            title="The book database is unreachable"
            body={
              response.shelf.length > 0
                ? "Your own shelf is shown above; new-book details are unavailable right now."
                : "Open Library and Google Books could not be reached. Check the connection, or add the book by hand."
            }
            query={query}
          />
        ) : (
          <EmptyState
            title="Nothing found"
            body={
              response.mode === "isbn"
                ? "Neither Open Library nor Google Books knows this ISBN. You can still add the book by hand."
                : "No matches. Try fewer words, or the author's surname."
            }
            query={query}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {shelf}

      {response.shelf.length > 0 ? (
        <div className="flex items-center gap-3 pt-1">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            Results from Open Library
          </span>
          <Separator className="flex-1" />
        </div>
      ) : null}

      {response.candidates.map((candidate: LookupCandidate, index) => (
        <CandidateCard
          key={`${candidate.isbn13 ?? candidate.title}-${index}`}
          candidate={candidate}
          prominent={response.mode === "isbn"}
        />
      ))}
    </div>
  )
}

function EmptyState({
  title,
  body,
  query,
}: {
  title: string
  body: string
  query: string
}) {
  return (
    <div className="bg-card flex flex-col items-start gap-3 rounded-2xl border border-dashed p-6">
      <div>
        <p className="font-serif text-lg font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <a href={`/library/new?q=${encodeURIComponent(query)}`}>Add it by hand</a>
      </Button>
    </div>
  )
}
