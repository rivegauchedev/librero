"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"

import { saveWork, type BookActionState } from "@/actions/books"
import type { WorkDetail } from "@/db/queries/works"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function EditWorkForm({ work }: { work: WorkDetail }) {
  const router = useRouter()
  const [state, action] = useActionState<BookActionState, FormData>(saveWork, {})

  useActionFeedback(state, () => router.push(`/works/${work.id}`))

  const series = work.series[0]

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="workId" value={work.id} />

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={work.title} required />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input id="subtitle" name="subtitle" defaultValue={work.subtitle ?? ""} />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="authors">Authors</Label>
            <Input
              id="authors"
              name="authors"
              defaultValue={work.authors
                .filter((author) => author.role === "author")
                .map((author) => author.name)
                .join(", ")}
              placeholder="Separate several with commas"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="firstPublishYear">First published</Label>
            <Input
              id="firstPublishYear"
              name="firstPublishYear"
              inputMode="numeric"
              defaultValue={work.firstPublishYear ?? ""}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="seriesName">Series</Label>
            <Input id="seriesName" name="seriesName" defaultValue={series?.name ?? ""} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="seriesPosition">Position in series</Label>
            <Input
              id="seriesPosition"
              name="seriesPosition"
              inputMode="decimal"
              defaultValue={series?.position ?? ""}
              placeholder="2.5 works too"
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              name="tags"
              defaultValue={work.tags.map((tag) => tag.name).join(", ")}
              placeholder="Separate several with commas"
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={6}
              defaultValue={work.description ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  )
}
