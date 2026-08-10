import { requireUser } from "@/lib/auth"
import { ManualBookForm } from "./components/manual-book-form"

export const metadata = { title: "Add a book — Librero" }

export default async function NewBookPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; title?: string; authors?: string }>
}) {
  await requireUser()
  const { q, title, authors } = await searchParams

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add a book by hand</h1>
        <p className="text-muted-foreground">
          For books with no ISBN, or that Open Library has never heard of.
        </p>
      </div>

      <ManualBookForm defaultTitle={title ?? q ?? ""} defaultAuthors={authors ?? ""} />
    </div>
  )
}
