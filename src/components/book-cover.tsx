import { BookOpen } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Covers are served from our own cache at /api/covers/... — never hotlinked, so
 * the app keeps working when Open Library is down or slow.
 */
export function BookCover({
  coverPath,
  title,
  className,
}: {
  coverPath: string | null
  title: string
  className?: string
}) {
  const shell = cn(
    "bg-muted relative aspect-2/3 w-full overflow-hidden rounded-md border",
    className
  )

  if (!coverPath) {
    return (
      <div className={cn(shell, "flex items-center justify-center p-2")}>
        <BookOpen className="text-muted-foreground/40 size-8" />
        <span className="sr-only">No cover for {title}</span>
      </div>
    )
  }

  return (
    <div className={shell}>
      {/* eslint-disable-next-line @next/next/no-img-element -- locally cached file, no optimizer needed */}
      <img
        src={`/api/covers/${coverPath}`}
        alt={`Cover of ${title}`}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </div>
  )
}
