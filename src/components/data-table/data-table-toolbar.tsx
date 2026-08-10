"use client"

import type { Table } from "@tanstack/react-table"
import { RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { DataTableViewOptions } from "./data-table-view-options"
import type { FacetConfig } from "./types"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  /** Column the free-text box filters on. Omit to hide the box. */
  searchColumn?: string
  searchPlaceholder?: string
  /** Multi-select filters, one per faceted column (format, status, medium…). */
  facets?: FacetConfig[]
  /** Rendered on the right of the toolbar — an "Add book" button, say. */
  actions?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  searchColumn,
  searchPlaceholder = "Search…",
  facets = [],
  actions,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {searchColumn ? (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn(searchColumn)?.setFilterValue(event.target.value)
            }
            className="h-9 w-[200px] lg:w-[280px]"
          />
        ) : null}

        {facets.map((facet) => {
          const column = table.getColumn(facet.column)
          if (!column) return null
          return (
            <DataTableFacetedFilter
              key={facet.column}
              column={column}
              title={facet.title}
              options={facet.options}
            />
          )
        })}

        {isFiltered ? (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-9 cursor-pointer px-2 lg:px-3"
          >
            <RefreshCcw className="h-4 w-4" />
            Reset
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <DataTableViewOptions table={table} />
        {actions}
      </div>
    </div>
  )
}
