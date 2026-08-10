"use client"

import * as React from "react"
import { useActionState } from "react"
import { Download, MapPin, Plus, Trash2 } from "lucide-react"

import { removeCopy, removeEdition, type BookActionState } from "@/actions/books"
import type { CopyDetail, EditionDetail } from "@/db/queries/works"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  fileFormatLabel,
  formatFileSize,
  formatLabel,
  mediumLabel,
} from "@/lib/labels"
import { CopyDialog } from "./copy-dialog"
import { UploadDialog } from "./upload-dialog"

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

      {copy.filePath ? (
        <a
          href={`/api/files/${copy.id}`}
          className="inline-flex items-center gap-1 underline underline-offset-4"
        >
          <Download className="size-3.5" />
          {copy.fileName ?? "Download"}
          <span className="text-muted-foreground">
            {copy.fileFormat ? ` (${fileFormatLabel(copy.fileFormat)}` : ""}
            {copy.fileSizeBytes ? `, ${formatFileSize(copy.fileSizeBytes)}` : ""}
            {copy.fileFormat ? ")" : ""}
          </span>
        </a>
      ) : null}

      {copy.notes ? (
        <span className="text-muted-foreground italic">{copy.notes}</span>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        <CopyDialog workId={workId} editionId={editionId} copy={copy} />
        {copy.medium === "digital" ? (
          <UploadDialog
            workId={workId}
            copyId={copy.id}
            hasFile={Boolean(copy.filePath)}
          />
        ) : null}
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

      <CardContent className="flex flex-col gap-3">
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
      </CardContent>
    </Card>
  )
}
