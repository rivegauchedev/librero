import { BookstoreCheck } from "./components/bookstore-check"

export const metadata = { title: "Check a book — Librero" }

export default function SearchPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Check a book</h1>
        <p className="text-muted-foreground">
          Scan a barcode or type a title. Librero tells you whether it is already on your
          shelf — and in which edition.
        </p>
      </div>

      <BookstoreCheck />
    </div>
  )
}
