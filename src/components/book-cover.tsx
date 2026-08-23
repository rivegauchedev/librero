import { BookOpen } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Covers are served from our own cache at /api/covers/... — never hotlinked, so
 * the app keeps working when Open Library is down or slow.
 *
 * A cover is drawn as a physical book rather than a thumbnail: the left edge is
 * squared off and darkened to read as a spine, the right corners are rounded
 * like a cut page block, and the whole thing casts a short shadow so it sits on
 * the shelf instead of floating over it.
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
    "bg-muted relative aspect-2/3 w-full overflow-hidden rounded-[2px_4px_4px_2px]",
    "shadow-[0_10px_14px_-10px_rgb(60_40_20/0.75)] dark:shadow-[0_10px_14px_-10px_rgb(0_0_0/0.8)]",
    className
  )

  /* Inset shadows paint under content, so the spine is its own overlay. */
  const spine = (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_3px_0_6px_-3px_rgb(0_0_0/0.35)]"
    />
  )

  /*
   * A cover we do not have still has to be identifiable. An older catalogue can
   * be mostly coverless, and the shelves view hides titles under the artwork —
   * so the fallback is not an icon but the title itself, set like the blank
   * jacket a library would wrap a book in.
   */
  if (!coverPath) {
    return (
      <div
        className={cn(
          shell,
          "flex flex-col justify-between border p-2 text-center"
        )}
      >
        <BookOpen className="text-muted-foreground/30 mx-auto mt-1 size-4 shrink-0" />
        <span className="font-serif text-foreground/70 line-clamp-4 px-0.5 text-[11px] leading-tight font-medium text-balance">
          {title}
        </span>
        <span aria-hidden className="bg-border/60 mx-auto h-px w-6 shrink-0" />
        {spine}
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
      {spine}
    </div>
  )
}
