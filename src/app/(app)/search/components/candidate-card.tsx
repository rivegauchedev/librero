"use client"

import * as React from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, Heart, Plus } from "lucide-react"
import { toast } from "sonner"

import { addBookByIsbn, type BookActionState } from "@/actions/books"
import type { LookupCandidate } from "@/app/api/lookup/route"
import { OwnershipBadge } from "@/components/ownership-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FORMAT_OPTIONS, MEDIUM_OPTIONS } from "@/lib/labels"
import { cn } from "@/lib/utils"

function AddButton({
  intent,
  disabled,
}: {
  intent: "own" | "wishlist"
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={intent === "own" ? "default" : "outline"}
      disabled={pending || disabled}
    >
      {intent === "own" ? <Plus /> : <Heart />}
      {intent === "own" ? "Add to library" : "Wishlist"}
    </Button>
  )
}

export function CandidateCard({
  candidate,
  prominent,
}: {
  candidate: LookupCandidate
  /** Single-ISBN results get the full add form; search hits stay compact. */
  prominent: boolean
}) {
  const router = useRouter()
  const [state, action] = useActionState<BookActionState, FormData>(addBookByIsbn, {})
  const [expanded, setExpanded] = React.useState(prominent)

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
    if (state.success) {
      toast.success(state.success)
      if (state.workId) router.push(`/works/${state.workId}`)
    }
  }, [state, router])

  const canAdd = Boolean(candidate.isbn13)
  const details = [
    candidate.publisher,
    candidate.firstPublishYear?.toString(),
    candidate.pageCount ? `${candidate.pageCount} pages` : null,
  ].filter(Boolean)

  return (
    <Card className={cn(prominent && "border-2")}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="bg-muted relative h-28 w-20 shrink-0 overflow-hidden rounded border">
            {candidate.coverUrl ? (
              // Remote provider thumbnail: shown before the book is saved, so
              // there is nothing cached locally to serve yet.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={candidate.coverUrl}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <BookOpen className="text-muted-foreground/40 size-6" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className={cn("leading-tight font-semibold", prominent && "text-lg")}>
              {candidate.title}
            </h2>
            {candidate.subtitle ? (
              <p className="text-muted-foreground text-sm">{candidate.subtitle}</p>
            ) : null}
            {candidate.authors.length > 0 ? (
              <p className="text-sm">{candidate.authors.join(", ")}</p>
            ) : null}
            {details.length > 0 ? (
              <p className="text-muted-foreground mt-1 text-xs">{details.join(" · ")}</p>
            ) : null}
            {candidate.isbn13 ? (
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {candidate.isbn13}
              </p>
            ) : null}
          </div>
        </div>

        <OwnershipBadge ownership={candidate.ownership} />

        {!canAdd ? (
          <p className="text-muted-foreground text-sm">
            This result has no ISBN, so it cannot be added automatically.{" "}
            <Link
              href={`/library/new?title=${encodeURIComponent(candidate.title)}&authors=${encodeURIComponent(candidate.authors.join(", "))}`}
              className="underline underline-offset-4"
            >
              Add it by hand
            </Link>
            .
          </p>
        ) : !expanded ? (
          <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
            <Plus />
            Add this one
          </Button>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="isbn" value={candidate.isbn13!} />

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor={`format-${candidate.isbn13}`}>Format</Label>
                <Select name="format" defaultValue="paperback">
                  <SelectTrigger id={`format-${candidate.isbn13}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`medium-${candidate.isbn13}`}>Medium</Label>
                <Select name="medium" defaultValue="physical">
                  <SelectTrigger id={`medium-${candidate.isbn13}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIUM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`quantity-${candidate.isbn13}`}>Copies</Label>
                <Input
                  id={`quantity-${candidate.isbn13}`}
                  name="quantity"
                  type="number"
                  min={1}
                  max={999}
                  defaultValue={1}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`location-${candidate.isbn13}`}>Where</Label>
                <Input
                  id={`location-${candidate.isbn13}`}
                  name="location"
                  placeholder="Office / shelf B3"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <AddButton intent="own" />
              <AddButton intent="wishlist" />
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
