"use client"

import * as React from "react"
import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { Heart, Plus } from "lucide-react"
import { useFormStatus } from "react-dom"

import { addBookManually, type BookActionState } from "@/actions/books"
import { useActionFeedback } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

function IntentButton({
  intent,
  children,
}: {
  intent: "own" | "wishlist"
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={intent === "own" ? "default" : "outline"}
      disabled={pending}
    >
      {intent === "own" ? <Plus /> : <Heart />}
      {children}
    </Button>
  )
}

export function ManualBookForm({
  defaultTitle,
  defaultAuthors,
}: {
  defaultTitle: string
  defaultAuthors: string
}) {
  const router = useRouter()
  const [state, action] = useActionState<BookActionState, FormData>(addBookManually, {})
  const [medium, setMedium] = React.useState<"physical" | "digital">("physical")

  useActionFeedback(state, () => {
    if (state.workId) router.push(`/works/${state.workId}`)
  })

  return (
    <form action={action} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>The book</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={defaultTitle} required autoFocus />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input id="subtitle" name="subtitle" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="authors">Authors</Label>
            <Input
              id="authors"
              name="authors"
              defaultValue={defaultAuthors}
              placeholder="Separate several with commas"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="firstPublishYear">First published</Label>
            <Input id="firstPublishYear" name="firstPublishYear" inputMode="numeric" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This edition</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="format">Format</Label>
            <Select name="format" defaultValue="paperback">
              <SelectTrigger id="format">
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
            <Label htmlFor="isbn13">ISBN-13</Label>
            <Input id="isbn13" name="isbn13" inputMode="numeric" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="publisher">Publisher</Label>
            <Input id="publisher" name="publisher" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="publishYear">Printed</Label>
            <Input id="publishYear" name="publishYear" inputMode="numeric" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pageCount">Pages</Label>
            <Input id="pageCount" name="pageCount" inputMode="numeric" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="editionNote">Edition note</Label>
            <Input
              id="editionNote"
              name="editionNote"
              placeholder="Folio Society illustrated, signed, 10th anniversary…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your copy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="medium">Medium</Label>
            <Select
              name="medium"
              value={medium}
              onValueChange={(value) => setMedium(value as "physical" | "digital")}
            >
              <SelectTrigger id="medium">
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
          <div className="grid gap-2">
            <Label htmlFor="quantity">How many</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={999}
              defaultValue={1}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location">Where it lives</Label>
            <Input id="location" name="location" placeholder="Office / shelf B3" />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <IntentButton intent="own">Add to my library</IntentButton>
        <IntentButton intent="wishlist">Add to wishlist</IntentButton>
      </div>
    </form>
  )
}
