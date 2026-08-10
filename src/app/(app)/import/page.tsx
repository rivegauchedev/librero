import { Download } from "lucide-react"

import { requireUser } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ImportWizard } from "./components/import-wizard"

export const metadata = { title: "Import and export — Librero" }

export default async function ImportPage() {
  await requireUser()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import and export</h1>
        <p className="text-muted-foreground">
          Bring in a spreadsheet or a Goodreads export, or take your whole catalogue away.
        </p>
      </div>

      <ImportWizard />

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            One row per copy, in Librero&rsquo;s own format. Importing it back reproduces
            the catalogue exactly — this is your escape hatch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/api/export" download>
              <Download />
              Download CSV
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
