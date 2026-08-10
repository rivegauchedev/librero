"use client"

import * as React from "react"
import { useActionState } from "react"
import { Pencil } from "lucide-react"

import { addCopy, saveCopy, type BookActionState } from "@/actions/books"
import type { CopyDetail } from "@/db/queries/works"
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
import { Textarea } from "@/components/ui/textarea"
import { toDateInput } from "@/lib/dates"
import { FILE_FORMAT_OPTIONS, MEDIUM_OPTIONS } from "@/lib/labels"

/**
 * One dialog for both adding and editing a copy — the fields are identical, and
 * a second near-duplicate form is a second place for them to drift.
 */
export function CopyDialog({
  workId,
  editionId,
  copy,
  trigger,
}: {
  workId: number
  editionId: number
  copy?: CopyDetail
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const editing = copy !== undefined
  const [state, action] = useActionState<BookActionState, FormData>(
    editing ? saveCopy : addCopy,
    {}
  )
  const [medium, setMedium] = React.useState(copy?.medium ?? "physical")
  useActionFeedback(state, () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Pencil className="size-4" />
            <span className="sr-only">Edit copy</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <form action={action}>
          <input type="hidden" name="workId" value={workId} />
          <input type="hidden" name="editionId" value={editionId} />
          {editing ? <input type="hidden" name="copyId" value={copy.id} /> : null}
          {/* medium is fixed once a copy exists: changing it would orphan a file */}
          {editing ? <input type="hidden" name="medium" value={copy.medium} /> : null}

          <DialogHeader>
            <DialogTitle>{editing ? "Edit copy" : "Add a copy"}</DialogTitle>
            <DialogDescription>
              Use the quantity if you own more than one of this exact edition.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {!editing ? (
              <div className="grid gap-2">
                <Label htmlFor="copy-medium">Medium</Label>
                <Select
                  name="medium"
                  value={medium}
                  onValueChange={(value) => setMedium(value as "physical" | "digital")}
                >
                  <SelectTrigger id="copy-medium">
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
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="copy-quantity">How many</Label>
              <Input
                id="copy-quantity"
                name="quantity"
                type="number"
                min={1}
                max={999}
                defaultValue={copy?.quantity ?? 1}
              />
            </div>

            {medium === "physical" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="copy-condition">Condition</Label>
                  <Input
                    id="copy-condition"
                    name="condition"
                    defaultValue={copy?.condition ?? ""}
                    placeholder="Like new, worn spine…"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="copy-location">Where it lives</Label>
                  <Input
                    id="copy-location"
                    name="location"
                    defaultValue={copy?.location ?? ""}
                    placeholder="Office / shelf B3"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="copy-service">Service</Label>
                  <Input
                    id="copy-service"
                    name="externalService"
                    defaultValue={copy?.externalService ?? ""}
                    placeholder="Kindle, Kobo, Audible…"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="copy-fileFormat">File format</Label>
                  <Select name="fileFormat" defaultValue={copy?.fileFormat ?? "epub"}>
                    <SelectTrigger id="copy-fileFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_FORMAT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <input type="hidden" name="location" value={copy?.location ?? ""} />
                <input type="hidden" name="condition" value="" />
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="copy-acquired">Acquired</Label>
              <Input
                id="copy-acquired"
                name="acquiredDate"
                type="date"
                defaultValue={toDateInput(copy?.acquiredDate ?? null)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="copy-price">Price paid</Label>
              <Input
                id="copy-price"
                name="purchasePrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  copy?.purchasePriceCents !== null && copy?.purchasePriceCents !== undefined
                    ? (copy.purchasePriceCents / 100).toFixed(2)
                    : ""
                }
              />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="copy-notes">Notes</Label>
              <Textarea
                id="copy-notes"
                name="notes"
                rows={2}
                defaultValue={copy?.notes ?? ""}
              />
            </div>
          </div>

          <DialogFooter>
            <SubmitButton>{editing ? "Save copy" : "Add copy"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
