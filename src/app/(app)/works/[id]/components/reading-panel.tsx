"use client"

import * as React from "react"
import { useActionState } from "react"
import { Star } from "lucide-react"

import { saveReadingProgress, type BookActionState } from "@/actions/books"
import type { WorkDetail } from "@/db/queries/works"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { READING_STATUS_OPTIONS } from "@/lib/labels"
import { cn } from "@/lib/utils"

/** Five stars, and a sixth click on the current one to take it back to unrated. */
function RatingInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const VERDICTS = ["", "Not for me", "Fine", "Good", "Very good", "Loved it"]

  return (
    <div className="flex items-center gap-1">
      <input type="hidden" name="rating" value={value} />
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(value === star ? 0 : star)}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          aria-pressed={value >= star}
          className="focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Star
            className={cn(
              "size-4.5 transition-colors",
              value >= star
                ? "fill-[oklch(0.66_0.14_70)] text-[oklch(0.66_0.14_70)]"
                : "fill-muted text-muted"
            )}
          />
        </button>
      ))}
      <span className="text-muted-foreground ml-1.5 text-xs">
        {VERDICTS[value] ?? ""}
      </span>
    </div>
  )
}

/**
 * "Where you are" and "Marginalia" — the two things about a book that are
 * yours rather than the publisher's. They share one form and one save, because
 * they are one thought: how far in you got, and what you made of it.
 */
export function ReadingPanel({
  work,
  pageCount,
}: {
  work: WorkDetail
  /** From the edition you hold, so the page input can show a denominator. */
  pageCount: number | null
}) {
  const [state, action] = useActionState<BookActionState, FormData>(
    saveReadingProgress,
    {}
  )
  useActionFeedback(state)

  const [status, setStatus] = React.useState(work.readingStatus)
  const [rating, setRating] = React.useState(work.rating ?? 0)

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workId" value={work.id} />
      <input type="hidden" name="readingStatus" value={status} />

      <div className="grid gap-4 lg:grid-cols-2">
      <fieldset className="bg-card flex flex-col gap-3 rounded-[14px] border px-5 py-4.5">
        <legend className="text-muted-foreground text-xs tracking-[0.08em] uppercase">
          Where you are
        </legend>

        <div className="inline-flex self-start overflow-hidden rounded-full border">
          {READING_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              aria-pressed={status === option.value}
              className={cn(
                "h-8 px-4 text-[13px] font-medium transition-colors",
                status === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <RatingInput value={rating} onChange={setRating} />

        {/* Only meaningful mid-book, so it only appears mid-book. */}
        {status === "reading" ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="currentPage" className="text-muted-foreground text-xs">
              On page
            </Label>
            <input
              id="currentPage"
              name="currentPage"
              type="number"
              min={0}
              max={pageCount ?? undefined}
              defaultValue={work.currentPage ?? ""}
              className="border-input bg-background focus-visible:ring-ring h-8 w-20 rounded-md border px-2 text-sm tabular-nums focus-visible:ring-1 focus-visible:outline-none"
            />
            <span className="text-muted-foreground text-xs">
              {pageCount ? `of ${pageCount}` : "of an unrecorded page count"}
            </span>
          </div>
        ) : (
          <input type="hidden" name="currentPage" value={work.currentPage ?? ""} />
        )}
      </fieldset>

      <fieldset className="bg-card flex flex-col gap-2 rounded-[14px] border px-5 py-4.5">
        <legend className="text-muted-foreground text-xs tracking-[0.08em] uppercase">
          Marginalia
        </legend>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={work.notes ?? ""}
          placeholder="What you thought, who lent it to you, where it came from…"
          className="font-serif resize-none border-0 bg-transparent p-0 text-[15px] italic shadow-none focus-visible:ring-0 md:text-[15px]"
        />
      </fieldset>
      </div>

      <div>
        <SubmitButton size="sm" variant="outline">
          Save
        </SubmitButton>
      </div>
    </form>
  )
}
