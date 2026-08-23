import { BookstoreCheck } from "./components/bookstore-check"

export const metadata = { title: "Check a book — Librero" }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  // Arriving from the overview's hero field, the query is already in hand —
  // running it here saves the second keystroke you have already made.
  const { q } = await searchParams

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5.5 px-4 pt-3 lg:px-7">
      <div className="text-center">
        <h1 className="font-serif text-[38px] leading-tight font-medium">
          Do you already own it?
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">
          Scan the barcode on the back. One answer, no scrolling.
        </p>
      </div>

      <BookstoreCheck initialQuery={q ?? ""} />
    </div>
  )
}
