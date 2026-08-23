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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 lg:px-7">
      <div>
        <h1 className="font-serif text-4xl leading-[1.1] font-medium">Bring books in</h1>
        <p className="text-muted-foreground mt-1.5 text-[15px]">
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
