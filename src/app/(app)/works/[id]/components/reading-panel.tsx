"use client"

import * as React from "react"
import { useActionState } from "react"
import { Star } from "lucide-react"

import { saveReadingProgress, type BookActionState } from "@/actions/books"
import type { WorkDetail } from "@/db/queries/works"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { READING_STATUS_OPTIONS } from "@/lib/labels"
import { cn } from "@/lib/utils"

function RatingInput({ defaultValue }: { defaultValue: number | null }) {
  const [rating, setRating] = React.useState(defaultValue ?? 0)

  return (
    <div className="flex items-center gap-1">
      <input type="hidden" name="rating" value={rating} />
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          // Clicking the current rating clears it — there is no other way back
          // to "unrated" once you have set one.
          onClick={() => setRating(rating === value ? 0 : value)}
          aria-label={`${value} star${value === 1 ? "" : "s"}`}
          aria-pressed={rating >= value}
          className="focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Star
            className={cn(
              "size-6 transition-colors",
              rating >= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
      {rating > 0 ? (
        <span className="text-muted-foreground ml-1 text-sm tabular-nums">{rating}/5</span>
      ) : null}
    </div>
  )
}

export function ReadingPanel({ work }: { work: WorkDetail }) {
  const [state, action] = useActionState<BookActionState, FormData>(
    saveReadingProgress,
    {}
  )
  useActionFeedback(state)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workId" value={work.id} />

      <h2 className="text-lg font-semibold">Reading</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
        <div className="grid gap-2">
          <Label htmlFor="readingStatus">Status</Label>
          <Select name="readingStatus" defaultValue={work.readingStatus}>
            <SelectTrigger id="readingStatus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {READING_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Rating</Label>
          <RatingInput defaultValue={work.rating} />
        </div>
      </div>

      <div className="grid gap-2 lg:max-w-3xl">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={work.notes ?? ""}
          placeholder="What you thought, who lent it to you, where it came from…"
        />
      </div>

      <div>
        <SubmitButton size="sm">Save reading details</SubmitButton>
      </div>
    </form>
  )
}
