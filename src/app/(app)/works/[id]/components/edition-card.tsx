"use client"

import * as React from "react"
import { useActionState } from "react"
import { ImagePlus, MapPin, Pencil, Plus, Trash2 } from "lucide-react"

import { removeCopy, removeEdition, type BookActionState } from "@/actions/books"
import type { CopyDetail, EditionDetail } from "@/db/queries/works"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookCover } from "@/components/book-cover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fileFormatLabel, formatLabel, mediumLabel } from "@/lib/labels"
import { CopyDialog } from "./copy-dialog"
import { EditionDialog } from "./edition-dialog"
import { LoanBadge, LoanControls, LoanHistory } from "./loan-controls"

function CopyRow({
  workId,
  editionId,
  copy,
}: {
  workId: number
  editionId: number
  copy: CopyDetail
}) {
  const [state, action] = useActionState<BookActionState, FormData>(removeCopy, {})
  useActionFeedback(state)

  const details = [
    copy.quantity > 1 ? `×${copy.quantity}` : null,
    copy.condition,
    copy.externalService,
    copy.fileFormat ? fileFormatLabel(copy.fileFormat) : null,
    copy.acquiredDate
      ? `acquired ${new Date(copy.acquiredDate * 1000).toLocaleDateString()}`
      : null,
    copy.purchasePriceCents !== null
      ? `${(copy.purchasePriceCents / 100).toFixed(2)}`
      : null,
  ].filter(Boolean)

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-2 text-sm first:border-t-0">
      <Badge variant={copy.medium === "digital" ? "secondary" : "outline"}>
        {mediumLabel(copy.medium)}
      </Badge>

      {details.length > 0 ? (
        <span className="text-muted-foreground">{details.join(" · ")}</span>
      ) : null}

      {copy.location ? (
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" />
          {copy.location}
        </span>
      ) : null}

      {copy.notes ? (
        <span className="text-muted-foreground italic">{copy.notes}</span>
      ) : null}

      <LoanBadge copy={copy} />

      <div className="ml-auto flex items-center gap-1">
        <LoanControls workId={workId} copy={copy} />
        <CopyDialog workId={workId} editionId={editionId} copy={copy} />
        <form action={action}>
          <input type="hidden" name="copyId" value={copy.id} />
          <input type="hidden" name="workId" value={workId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Remove copy</span>
          </Button>
        </form>
      </div>

      <LoanHistory copy={copy} />
    </li>
  )
}

export function EditionCard({
  workId,
  edition,
}: {
  workId: number
  edition: EditionDetail
}) {
  const [state, action] = useActionState<BookActionState, FormData>(removeEdition, {})
  useActionFeedback(state)

  const subtitle = [
    edition.publisher,
    edition.publishYear?.toString(),
    edition.pageCount ? `${edition.pageCount} pages` : null,
    edition.language,
  ]
    .filter(Boolean)
    .join(" · ")

  const copyTotal = edition.copies.reduce((sum, copy) => sum + copy.quantity, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Badge>{formatLabel(edition.format)}</Badge>
          {edition.editionNote ? (
            <span className="italic">{edition.editionNote}</span>
          ) : null}
          {copyTotal === 0 ? (
            <Badge variant="outline" className="font-normal">
              Not owned
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm font-normal">
              {copyTotal} {copyTotal === 1 ? "copy" : "copies"}
            </span>
          )}
        </CardTitle>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
          {subtitle ? <span>{subtitle}</span> : null}
          {edition.isbn13 ? <span className="font-mono">{edition.isbn13}</span> : null}
        </div>
      </CardHeader>

      <CardContent className="flex gap-4">
        {/* Each edition shows its own cover: which printing has artwork, and
            which is still missing one, is otherwise invisible. */}
        <div className="hidden w-20 shrink-0 sm:block">
          <BookCover coverPath={edition.coverPath} title={`edition ${edition.id}`} />
          {!edition.coverPath ? (
            <EditionDialog
              workId={workId}
              edition={edition}
              trigger={
                <Button variant="ghost" size="sm" className="mt-1 h-auto w-full px-1 py-1 text-xs">
                  <ImagePlus className="size-3.5" />
                  Add cover
                </Button>
              }
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
        {edition.copies.length > 0 ? (
          <ul className="flex flex-col">
            {edition.copies.map((copy) => (
              <CopyRow
                key={copy.id}
                workId={workId}
                editionId={edition.id}
                copy={copy}
              />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No copies of this edition on the shelf.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <CopyDialog
            workId={workId}
            editionId={edition.id}
            trigger={
              <Button variant="outline" size="sm">
                <Plus />
                Add a copy
              </Button>
            }
          />
          <EditionDialog
            workId={workId}
            edition={edition}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-4" />
                Edit edition
              </Button>
            }
          />

          <form action={action} className="ml-auto">
            <input type="hidden" name="editionId" value={edition.id} />
            <input type="hidden" name="workId" value={workId} />
            <SubmitButton
              variant="ghost"
              size="sm"
              pendingLabel="Removing…"
              className="text-muted-foreground hover:text-destructive"
            >
              Remove edition
            </SubmitButton>
          </form>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
