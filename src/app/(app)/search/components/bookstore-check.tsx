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

export function BookstoreCheck() {
  const [query, setQuery] = React.useState("")
  const [scanning, setScanning] = React.useState(false)
  const [state, setState] = React.useState<State>({ kind: "idle" })
  const requestId = React.useRef(0)

  const run = React.useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (trimmed.length < 2) {
      setState({ kind: "idle" })
      return
    }

    // Out-of-order responses would otherwise overwrite a newer result.
    const id = ++requestId.current
    setState({ kind: "loading" })

    try {
      // cache: "no-store" as well as the response header — belt and braces on a
      // request whose answer changes the moment you add the book.
      const response = await fetch(`/api/lookup?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      })
      if (id !== requestId.current) return

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setState({
          kind: "error",
          message: body.error ?? "The lookup failed. Please try again.",
        })
        return
      }

      setState({
        kind: "results",
        response: (await response.json()) as LookupResponse,
        query: trimmed,
      })
    } catch {
      if (id !== requestId.current) return
      setState({ kind: "error", message: "Could not reach the server." })
    }
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
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ISBN, title or author"
          inputMode="search"
          autoFocus
          className="h-11 text-base"
        />
        <Button type="submit" size="lg" disabled={query.trim().length < 2}>
          <Search />
          <span className="sr-only sm:not-sr-only">Check</span>
        </Button>
        <Button
          type="button"
          size="lg"
          variant={scanning ? "secondary" : "outline"}
          onClick={() => setScanning((open) => !open)}
        >
          <ScanBarcode />
          <span className="sr-only">{scanning ? "Close camera" : "Scan a barcode"}</span>
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
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <a href={`/library/new?q=${encodeURIComponent(query)}`}>Add it by hand</a>
      </Button>
    </div>
  )
}
