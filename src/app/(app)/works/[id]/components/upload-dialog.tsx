"use client"

import * as React from "react"
import { useActionState } from "react"
import { Upload } from "lucide-react"

import { uploadEbook, type UploadActionState } from "@/actions/uploads"
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

export function UploadDialog({
  workId,
  copyId,
  hasFile = false,
}: {
  workId: number
  copyId: number
  hasFile?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [state, action] = useActionState<UploadActionState, FormData>(uploadEbook, {})
  useActionFeedback(state, () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Upload className="size-4" />
          <span className="sr-only">{hasFile ? "Replace file" : "Upload file"}</span>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form action={action}>
          <input type="hidden" name="copyId" value={copyId} />
          <input type="hidden" name="workId" value={workId} />

          <DialogHeader>
            <DialogTitle>{hasFile ? "Replace the file" : "Upload the file"}</DialogTitle>
            <DialogDescription>
              EPUB, PDF, MOBI, AZW3 or CBZ. Stored on this server and only ever served to
              signed-in users.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            <Label htmlFor={`file-${copyId}`}>File</Label>
            <Input
              id={`file-${copyId}`}
              name="file"
              type="file"
              accept=".epub,.pdf,.mobi,.azw3,.cbz,.prc,.azw"
              required
            />
          </div>

          <DialogFooter>
            <SubmitButton pendingLabel="Uploading…">
              <Upload />
              Upload
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
