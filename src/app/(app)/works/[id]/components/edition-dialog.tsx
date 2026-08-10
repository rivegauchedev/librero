"use client"

import * as React from "react"
import { useActionState } from "react"
import { BookPlus, ImageOff, Pencil, Plus } from "lucide-react"

import { addEdition, removeEditionCover, saveEdition, type BookActionState } from "@/actions/books"
import type { EditionDetail } from "@/db/queries/works"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
import { BookCover } from "@/components/book-cover"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FORMAT_OPTIONS } from "@/lib/labels"

/**
 * One dialog for adding and for editing an edition — the fields are the same,
 * and a second near-identical form is a second place for them to drift.
 *
 * The cover field only appears when editing, because an edition has to exist
 * before an image can be attached to it.
 */
export function EditionDialog({
  workId,
  edition,
  trigger,
}: {
  workId: number
  edition?: EditionDetail
  trigger?: React.ReactNode
}) {
  const editing = edition !== undefined
  const [open, setOpen] = React.useState(false)
  const [state, action] = useActionState<BookActionState, FormData>(
    editing ? saveEdition : addEdition,
    {}
  )
  useActionFeedback(state, () => setOpen(false))

  const id = (field: string) => `edition-${edition?.id ?? "new"}-${field}`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Pencil className="size-4" />
            <span className="sr-only">Edit edition</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form action={action}>
          <input type="hidden" name="workId" value={workId} />
          {editing ? <input type="hidden" name="editionId" value={edition.id} /> : null}

          <DialogHeader>
            <DialogTitle>{editing ? "Edit edition" : "Add an edition"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Details of this particular printing."
                : "A different printing of the same book — a hardcover, a translation, a special edition."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={id("format")}>Format</Label>
              <Select name="format" defaultValue={edition?.format ?? "hardcover"}>
                <SelectTrigger id={id("format")}>
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

            <div className="grid gap-2">
              <Label htmlFor={id("isbn13")}>ISBN-13</Label>
              <Input
                id={id("isbn13")}
                name="isbn13"
                inputMode="numeric"
                defaultValue={edition?.isbn13 ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={id("isbn10")}>ISBN-10</Label>
              <Input
                id={id("isbn10")}
                name="isbn10"
                defaultValue={edition?.isbn10 ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={id("publisher")}>Publisher</Label>
              <Input
                id={id("publisher")}
                name="publisher"
                defaultValue={edition?.publisher ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={id("publishYear")}>Year</Label>
              <Input
                id={id("publishYear")}
                name="publishYear"
                inputMode="numeric"
                defaultValue={edition?.publishYear ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={id("pageCount")}>Pages</Label>
              <Input
                id={id("pageCount")}
                name="pageCount"
                inputMode="numeric"
                defaultValue={edition?.pageCount ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={id("language")}>Language</Label>
              <Input
                id={id("language")}
                name="language"
                placeholder="eng"
                defaultValue={edition?.language ?? ""}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={id("editionNote")}>Edition note</Label>
              <Input
                id={id("editionNote")}
                name="editionNote"
                placeholder="Folio Society illustrated, signed, 10th anniversary…"
                defaultValue={edition?.editionNote ?? ""}
              />
            </div>

            {editing ? <CoverField workId={workId} edition={edition} idFor={id} /> : null}
          </div>

          <DialogFooter>
            <SubmitButton>
              {editing ? (
                "Save edition"
              ) : (
                <>
                  <Plus />
                  Add edition
                </>
              )}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Cover by URL.
 *
 * The image is downloaded and stored locally rather than linked, exactly as
 * provider covers are: the shelf keeps working when the source disappears, and
 * nothing leaks what is being read to whoever hosts the image.
 */
function CoverField({
  workId,
  edition,
  idFor,
}: {
  workId: number
  edition: EditionDetail
  idFor: (field: string) => string
}) {
  return (
    <div className="grid gap-3 border-t pt-4 sm:col-span-2">
      <div className="flex items-start gap-4">
        <BookCover
          coverPath={edition.coverPath}
          title="this edition"
          className="w-20 shrink-0"
        />

        <div className="grid flex-1 gap-2">
          <Label htmlFor={idFor("coverUrl")}>
            {edition.coverPath ? "Replace the cover" : "Cover image URL"}
          </Label>
          <Input
            id={idFor("coverUrl")}
            name="coverUrl"
            type="url"
            inputMode="url"
            placeholder="https://…/cover.jpg"
            defaultValue={edition.coverSourceUrl ?? ""}
          />
          <p className="text-muted-foreground text-xs">
            JPEG, PNG, WebP or GIF, up to 5 MB. The image is downloaded and kept on this
            server, so it survives the original link going away.
          </p>
        </div>
      </div>

      {edition.coverPath ? (
        <RemoveCoverButton workId={workId} editionId={edition.id} />
      ) : null}
    </div>
  )
}

/**
 * Its own form, submitted separately: nesting a second form inside the edition
 * form is invalid HTML, and formAction would submit the edition fields too.
 */
function RemoveCoverButton({ workId, editionId }: { workId: number; editionId: number }) {
  const [state, action] = useActionState<BookActionState, FormData>(
    removeEditionCover,
    {}
  )
  useActionFeedback(state)

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive justify-self-start"
      onClick={() => {
        const data = new FormData()
        data.set("editionId", String(editionId))
        data.set("workId", String(workId))
        React.startTransition(() => action(data))
      }}
    >
      <ImageOff className="size-4" />
      Remove cover
    </Button>
  )
}

/** Convenience wrapper for the "add" case, so callers read clearly. */
export function AddEditionDialog({ workId }: { workId: number }) {
  return (
    <EditionDialog
      workId={workId}
      trigger={
        <Button variant="outline" size="sm">
          <BookPlus />
          Add edition
        </Button>
      }
    />
  )
}
