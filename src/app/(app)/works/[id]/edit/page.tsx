import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireUser } from "@/lib/auth"
import { getWorkDetail } from "@/db/queries/works"
import { Button } from "@/components/ui/button"
import { EditWorkForm } from "./components/edit-work-form"

export const metadata = { title: "Edit book — Librero" }

export default async function EditWorkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()

  const { id } = await params
  const work = getWorkDetail(Number(id))
  if (!work) notFound()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 lg:px-7">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href={`/works/${work.id}`}>
          <ArrowLeft />
          Back to {work.title}
        </Link>
      </Button>

      <div>
        <h1 className="font-serif text-3xl font-medium">Edit book</h1>
        <p className="text-muted-foreground">
          These details describe the book itself. Editions and copies are edited on the
          book&rsquo;s own page.
        </p>
      </div>

      <EditWorkForm work={work} />
    </div>
  )
}
