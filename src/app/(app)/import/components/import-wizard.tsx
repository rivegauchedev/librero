"use client"

import * as React from "react"
import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Upload } from "lucide-react"
import { toast } from "sonner"

import {
  confirmCsvImport,
  previewCsvImport,
  type ImportState,
} from "@/actions/import"
import { SubmitButton } from "@/components/action-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const OUTCOME_LABELS: Record<string, string> = {
  new: "New book",
  "new-edition": "New edition of a book you have",
  duplicate: "Already recorded",
  skipped: "Skipped",
}

export function ImportWizard() {
  const router = useRouter()
  const [state, action] = useActionState<ImportState, FormData>(previewCsvImport, {})
  const [skipDuplicates, setSkipDuplicates] = React.useState(true)
  const [committing, setCommitting] = React.useState(false)

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  const preview = state.preview

  async function commit() {
    if (!preview) return
    setCommitting(true)
    const result = await confirmCsvImport(preview.rows, skipDuplicates)
    setCommitting(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(result.success ?? "Imported.")
    router.push("/library")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import</CardTitle>
        <CardDescription>
          Librero&rsquo;s own export or a Goodreads export — the format is detected from
          the header row. Nothing is written until you confirm.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-64 flex-1 gap-2">
            <Label htmlFor="csv">CSV file</Label>
            <Input id="csv" name="file" type="file" accept=".csv,text/csv" required />
          </div>
          <SubmitButton variant="outline" pendingLabel="Reading…">
            <Upload />
            Preview
          </SubmitButton>
        </form>

        {preview ? (
          <div className="flex flex-col gap-4 border-t pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {preview.dialect === "goodreads" ? "Goodreads export" : "Librero export"}
              </Badge>
              <Badge variant="outline">{preview.counts.new} new books</Badge>
              <Badge variant="outline">{preview.counts.newEdition} new editions</Badge>
              <Badge variant="outline">{preview.counts.duplicate} already recorded</Badge>
              {preview.counts.skipped > 0 ? (
                <Badge variant="outline">{preview.counts.skipped} unusable</Badge>
              ) : null}
            </div>

            {preview.problems.length > 0 ? (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Some rows could not be read</p>
                  <ul className="text-muted-foreground mt-1 space-y-0.5">
                    {preview.problems.map((problem) => (
                      <li key={problem.line}>
                        Line {problem.line}: {problem.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>ISBN</TableHead>
                    <TableHead>What happens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.sample.map((row, index) => (
                    <TableRow key={`${row.isbn13 ?? row.title}-${index}`}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell>{row.authors}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.isbn13 ?? "—"}
                      </TableCell>
                      <TableCell>{OUTCOME_LABELS[row.outcome] ?? row.outcome}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {preview.rows.length > preview.sample.length ? (
              <p className="text-muted-foreground text-sm">
                Showing the first {preview.sample.length} of {preview.rows.length} rows.
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Checkbox
                id="skip-duplicates"
                checked={skipDuplicates}
                onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
              />
              <Label htmlFor="skip-duplicates" className="font-normal">
                Skip rows whose ISBN is already recorded
              </Label>
            </div>

            <div>
              <Button onClick={commit} disabled={committing}>
                {committing
                  ? "Importing…"
                  : `Import ${preview.rows.length} ${preview.rows.length === 1 ? "row" : "rows"}`}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
