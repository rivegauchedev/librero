"use client"

import * as React from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { MapPin, Star } from "lucide-react"

import type { WorkListRow } from "@/db/queries/works"
import { BookCard } from "@/components/book-card"
import { Shelf } from "@/components/shelf"
import { DataTable, DataTableColumnHeader } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { roomKey } from "@/lib/shelves"
import { cn } from "@/lib/utils"
import {
  FORMAT_OPTIONS,
  READING_STATUS_OPTIONS,
  formatLabel,
  readingStatusLabel,
} from "@/lib/labels"

type ViewMode = "shelves" | "covers" | "list"

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "shelves", label: "Shelves" },
  { value: "covers", label: "Covers" },
  { value: "list", label: "List" },
]

type Filter = "all" | "unread" | "reading" | "loan"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All books" },
  { value: "unread", label: "Unread" },
  { value: "reading", label: "Reading" },
  { value: "loan", label: "Lent out" },
]

/** One rail: the books that sit in one place, in the order they sit there. */
export type ShelfGroup = {
  /** Case- and spacing-insensitive shelf identity; see `lib/shelves`. */
  key: string
  room: string
  label: string
  /** Colour shared by every rail in this room, assigned server-side. */
  swatch: string
  workIds: number[]
}

/**
 * Three ways of looking at the same books.
 *
 * "Shelves" is the one the redesign leads with: books grouped by where they
 * physically are, each row standing on its own rail, so the screen is a picture
 * of the room rather than a list of records. "Covers" is the flat grid for when
 * you only half-remember the jacket, and "List" is the table for the questions
 * covers cannot answer — have I read it, what did I rate it, where is it.
 */
export function LibraryView({
  works,
  shelves,
  room,
}: {
  works: WorkListRow[]
  shelves: ShelfGroup[]
  /**
   * The room the sidebar deep-linked into, straight from the URL.
   *
   * Deliberately not held in state. Seeding `useState` with it looks equivalent
   * but breaks on client-side navigation: moving between rooms re-renders this
   * component with a new prop, and `useState` ignores an initial value after
   * the first mount, so the chips would change while the shelves did not. The
   * URL is the only copy of this, which also makes the back button work.
   */
  room?: string
}) {
  const [mode, setMode] = React.useState<ViewMode>("shelves")
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")

  const byId = React.useMemo(
    () => new Map(works.map((work) => [work.id, work])),
    [works]
  )

  const matches = React.useCallback(
    (work: WorkListRow) => {
      const needle = query.trim().toLowerCase()
      if (
        needle &&
        !work.title.toLowerCase().includes(needle) &&
        !work.authors.toLowerCase().includes(needle) &&
        !(work.series ?? "").toLowerCase().includes(needle)
      ) {
        return false
      }

      if (filter === "unread") return work.readingStatus === "unread"
      if (filter === "reading") return work.readingStatus === "reading"
      if (filter === "loan") return work.onLoan
      return true
    },
    [query, filter]
  )

  const filtered = React.useMemo(() => works.filter(matches), [works, matches])

  const visibleShelves = React.useMemo(() => {
    // Compared on the same footing rooms are grouped on, so a hand-typed or
    // bookmarked ?room=office still finds the room shown as "Office".
    const wanted = room ? roomKey(room) : null
    return (
      shelves
        .filter((group) => !wanted || roomKey(group.room) === wanted)
        .map((group) => ({
          ...group,
          books: group.workIds
            .map((id) => byId.get(id))
            .filter((work): work is WorkListRow => Boolean(work) && matches(work!)),
        }))
        .filter((group) => group.books.length > 0)
    )
  }, [shelves, room, byId, matches])

  const columns = React.useMemo<ColumnDef<WorkListRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
        cell: ({ row }) => (
          <Link
            href={`/works/${row.original.id}`}
            className="font-serif font-medium underline-offset-4 hover:underline"
          >
            {row.original.title}
            {row.original.series ? (
              <span className="text-muted-foreground ml-2 font-sans text-xs">
                {row.original.series}
              </span>
            ) : null}
          </Link>
        ),
        sortingFn: (a, b) => a.original.sortTitle.localeCompare(b.original.sortTitle),
      },
      {
        accessorKey: "authors",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Author" />,
        cell: ({ row }) => <span className="text-sm">{row.original.authors}</span>,
      },
      {
        id: "formats",
        accessorFn: (row) => (row.formats ? row.formats.split(",").filter(Boolean) : []),
        header: "Formats",
        cell: ({ row }) => {
          const formats = row.original.formats
            ? row.original.formats.split(",").filter(Boolean)
            : []
          return (
            <div className="flex flex-wrap gap-1">
              {formats.map((format) => (
                <Badge key={format} variant="secondary" className="text-xs">
                  {formatLabel(format)}
                </Badge>
              ))}
            </div>
          )
        },
        // The cell holds an array, so the faceted filter needs "any overlap".
        filterFn: (row, id, selected: string[]) => {
          const values = row.getValue<string[]>(id)
          return selected.some((value) => values.includes(value))
        },
      },
      {
        accessorKey: "copyCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Copies" />,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.copyCount}</span>
        ),
      },
      {
        accessorKey: "readingStatus",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge variant="outline">{readingStatusLabel(row.original.readingStatus)}</Badge>
        ),
        filterFn: (row, id, selected: string[]) => selected.includes(row.getValue(id)),
      },
      {
        accessorKey: "rating",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
        cell: ({ row }) =>
          row.original.rating ? (
            <span className="inline-flex items-center gap-1 text-sm tabular-nums">
              <Star className="size-3.5 fill-current" />
              {row.original.rating}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "locations",
        header: "Where",
        cell: ({ row }) =>
          row.original.locations ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
              <MapPin className="size-3" />
              {row.original.locations}
            </span>
          ) : null,
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2.5 border-b pb-2.5">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Title, author, series…"
          className="bg-card h-8.5 w-[260px] rounded-full px-3.5"
        />

        {FILTERS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setFilter(chip.value)}
            className={cn(
              "h-7.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              filter === chip.value
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:bg-accent border-border"
            )}
          >
            {chip.label}
          </button>
        ))}

        {room ? (
          <Link
            href="/library"
            className="bg-secondary text-secondary-foreground hover:bg-accent inline-flex h-7.5 items-center rounded-full px-3.5 text-[13px] font-medium"
          >
            {room}
            <span aria-hidden className="text-muted-foreground ml-1.5">
              ✕
            </span>
            <span className="sr-only">— show every room</span>
          </Link>
        ) : null}

        <div className="bg-card ml-auto inline-flex overflow-hidden rounded-full border">
          {VIEWS.map((view) => (
            <button
              key={view.value}
              type="button"
              onClick={() => setMode(view.value)}
              aria-pressed={mode === view.value}
              className={cn(
                "h-8 px-3.5 text-[13px] font-medium transition-colors",
                mode === view.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "list" ? (
        <DataTable
          columns={columns}
          data={filtered}
          searchColumn="title"
          searchPlaceholder="Search titles…"
          facets={[
            { column: "formats", title: "Format", options: FORMAT_OPTIONS },
            { column: "readingStatus", title: "Status", options: READING_STATUS_OPTIONS },
          ]}
          emptyMessage="No books match those filters."
          initialSorting={[{ id: "title", desc: false }]}
        />
      ) : mode === "covers" ? (
        filtered.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {filtered.map((work) => (
              <BookCard key={work.id} work={work} />
            ))}
          </div>
        )
      ) : visibleShelves.length === 0 ? (
        <Empty />
      ) : (
        <div className="flex flex-col gap-7">
          {visibleShelves.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2.5">
                <span
                  aria-hidden
                  className="size-2.25 shrink-0 rounded-[2px]"
                  style={{ background: group.swatch }}
                />
                <h2 className="font-serif text-xl font-medium">{group.label}</h2>
                <span className="text-muted-foreground text-xs">
                  {group.books.length} {group.books.length === 1 ? "book" : "books"}
                </span>
              </div>
              <Shelf>
                <div className="grid grid-cols-4 items-end gap-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9">
                  {group.books.map((work) => (
                    <BookCard key={work.id} work={work} showLabel={false} />
                  ))}
                </div>
              </Shelf>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Empty() {
  return (
    <p className="text-muted-foreground py-10 text-sm">Nothing matches that filter.</p>
  )
}
