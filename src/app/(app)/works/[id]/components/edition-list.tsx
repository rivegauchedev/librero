"use client"

import * as React from "react"
import { useActionState } from "react"
import { BookPlus, Plus } from "lucide-react"

import { addEdition, type BookActionState } from "@/actions/books"
import type { WorkDetail } from "@/db/queries/works"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
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
import { EditionCard } from "./edition-card"

function AddEditionDialog({ workId }: { workId: number }) {
  const [open, setOpen] = React.useState(false)
  const [state, action] = useActionState<BookActionState, FormData>(addEdition, {})
  useActionFeedback(state, () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookPlus />
          Add edition
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={action}>
          <input type="hidden" name="workId" value={workId} />
          <DialogHeader>
            <DialogTitle>Add an edition</DialogTitle>
            <DialogDescription>
              A different printing of the same book — a hardcover, a translation, a
              special edition.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="new-format">Format</Label>
              <Select name="format" defaultValue="hardcover">
                <SelectTrigger id="new-format">
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
              <Label htmlFor="new-isbn13">ISBN-13</Label>
              <Input id="new-isbn13" name="isbn13" inputMode="numeric" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-publisher">Publisher</Label>
              <Input id="new-publisher" name="publisher" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-publishYear">Year</Label>
              <Input id="new-publishYear" name="publishYear" inputMode="numeric" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-pageCount">Pages</Label>
              <Input id="new-pageCount" name="pageCount" inputMode="numeric" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="new-editionNote">Edition note</Label>
              <Input
                id="new-editionNote"
                name="editionNote"
                placeholder="Folio Society illustrated, signed, 10th anniversary…"
              />
            </div>
            <input type="hidden" name="isbn10" value="" />
            <input type="hidden" name="language" value="" />
          </div>

          <DialogFooter>
            <SubmitButton>
              <Plus />
              Add edition
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditionList({ work }: { work: WorkDetail }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Editions and copies</h2>
          <p className="text-muted-foreground text-sm">
            One edition per printing; one copy per book you actually hold.
          </p>
        </div>
        <AddEditionDialog workId={work.id} />
      </div>

      {work.editions.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
          No editions recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {work.editions.map((edition) => (
            <EditionCard key={edition.id} workId={work.id} edition={edition} />
          ))}
        </div>
      )}
    </section>
  )
}
