"use client"

import * as React from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { LayoutGrid, List, MapPin, Star } from "lucide-react"

import type { WorkListRow } from "@/db/queries/works"
import { BookCard } from "@/components/book-card"
import { DataTable, DataTableColumnHeader } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  FORMAT_OPTIONS,
  READING_STATUS_OPTIONS,
  formatLabel,
  readingStatusLabel,
} from "@/lib/labels"

type ViewMode = "grid" | "table"

/**
 * Two ways of looking at the same list. The grid is for browsing by cover; the
 * table is for answering "where is it?" and "have I read it?" across the whole
 * shelf at once, with the faceted filters from the template's data table.
 */
export function LibraryView({ works }: { works: WorkListRow[] }) {
  const [mode, setMode] = React.useState<ViewMode>("grid")
  const [gridQuery, setGridQuery] = React.useState("")

  const columns = React.useMemo<ColumnDef<WorkListRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
        cell: ({ row }) => (
          <Link
            href={`/works/${row.original.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.title}
            {row.original.series ? (
              <span className="text-muted-foreground ml-2 text-xs">
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

  const filteredForGrid = React.useMemo(() => {
    const needle = gridQuery.trim().toLowerCase()
    if (!needle) return works
    return works.filter(
      (work) =>
        work.title.toLowerCase().includes(needle) ||
        work.authors.toLowerCase().includes(needle) ||
        (work.series ?? "").toLowerCase().includes(needle)
    )
  }, [works, gridQuery])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {mode === "grid" ? (
          <Input
            value={gridQuery}
            onChange={(event) => setGridQuery(event.target.value)}
            placeholder="Filter by title, author or series…"
            className="h-9 max-w-sm"
          />
        ) : (
          <span />
        )}

        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(value) => value && setMode(value as ViewMode)}
          variant="outline"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <List className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {mode === "grid" ? (
        filteredForGrid.length === 0 ? (
          <p className="text-muted-foreground py-8 text-sm">Nothing matches that filter.</p>
        ) : (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
            {filteredForGrid.map((work) => (
              <BookCard key={work.id} work={work} />
            ))}
          </div>
        )
      ) : (
        <DataTable
          columns={columns}
          data={works}
          searchColumn="title"
          searchPlaceholder="Search titles…"
          facets={[
            { column: "formats", title: "Format", options: FORMAT_OPTIONS },
            { column: "readingStatus", title: "Status", options: READING_STATUS_OPTIONS },
          ]}
          emptyMessage="No books match those filters."
          initialSorting={[{ id: "title", desc: false }]}
        />
      )}
    </div>
  )
}
