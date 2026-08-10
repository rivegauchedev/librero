import Link from "next/link"

import type { WorkListRow } from "@/db/queries/works"
import { BookCover } from "@/components/book-cover"
import { Badge } from "@/components/ui/badge"
import { formatLabel } from "@/lib/labels"

export function BookCard({ work }: { work: WorkListRow }) {
  const formats = work.formats ? work.formats.split(",").filter(Boolean) : []

  return (
    <Link
      href={`/works/${work.id}`}
      className="group focus-visible:ring-ring flex flex-col gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
    >
      <BookCover
        coverPath={work.coverPath}
        title={work.title}
        className="transition-shadow group-hover:shadow-md"
      />
      <div className="flex flex-col gap-1">
        <span className="line-clamp-2 text-sm leading-snug font-medium">{work.title}</span>
        {work.authors ? (
          <span className="text-muted-foreground line-clamp-1 text-xs">{work.authors}</span>
        ) : null}
        {formats.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {formats.map((format) => (
              <Badge key={format} variant="secondary" className="px-1.5 py-0 text-[10px]">
                {formatLabel(format)}
              </Badge>
            ))}
            {work.copyCount > 1 ? (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                ×{work.copyCount}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  )
}
