import Link from "next/link"

import type { WorkListRow } from "@/db/queries/works"
import { BookCover } from "@/components/book-cover"
import { cn } from "@/lib/utils"

/**
 * A book as it appears standing on a shelf: cover, then title and author set in
 * the serif so the catalogue reads like a library rather than a spreadsheet.
 * Formats and copy counts are deliberately absent — they matter on the book's
 * own page, not when you are scanning a row of spines for one you recognise.
 */
export function BookCard({
  work,
  showLabel = true,
  className,
}: {
  work: WorkListRow
  /** Off for the dense shelves view, where the covers speak for themselves. */
  showLabel?: boolean
  className?: string
}) {
  return (
    <Link
      href={`/works/${work.id}`}
      title={work.authors ? `${work.title} — ${work.authors}` : work.title}
      className={cn(
        "group focus-visible:ring-ring block rounded-[2px_4px_4px_2px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className
      )}
    >
      <BookCover
        coverPath={work.coverPath}
        title={work.title}
        className="transition-transform duration-150 ease-out group-hover:-translate-y-1"
      />
      {showLabel ? (
        <div className="mt-2.5">
          <p className="font-serif line-clamp-2 h-9 text-sm leading-tight font-medium">
            {work.title}
          </p>
          {work.authors ? (
            <p className="text-muted-foreground mt-px line-clamp-1 text-[11px]">
              {work.authors}
            </p>
          ) : null}
        </div>
      ) : null}
    </Link>
  )
}
