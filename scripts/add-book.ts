/**
 * Add a book from the command line, by ISBN.
 *
 *   npm run book:add -- 9780441013593 --format hardcover --quantity 2 --where "Office / B3"
 *
 * Useful for bulk-loading a shelf you already have a list of, and for checking
 * the provider pipeline without a browser.
 */
import { createCopy, importBook } from "@/db/mutations/catalog"
import { EDITION_FORMATS, type EditionFormat } from "@/db/schema"
import { cacheCover } from "@/lib/covers"
import { lookupByIsbn } from "@/lib/providers"

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const isbn = process.argv[2]
if (!isbn || isbn.startsWith("--")) {
  console.error("Usage: npm run book:add -- <isbn> [--format paperback] [--quantity 1] [--where '...'] [--wishlist]")
  process.exit(1)
}

const format = flag("format") as EditionFormat | undefined
if (format && !EDITION_FORMATS.includes(format)) {
  console.error(`--format must be one of: ${EDITION_FORMATS.join(", ")}`)
  process.exit(1)
}

const wishlist = process.argv.includes("--wishlist")

async function main() {
  const book = await lookupByIsbn(isbn!)
  if (!book) {
    console.error(`No book found for ISBN ${isbn}.`)
    process.exit(1)
  }

  const coverPath = book.coverUrl ? await cacheCover(book.coverUrl) : null
  const result = importBook(book, { coverPath, format, asWishlist: wishlist })

  if (!wishlist) {
    createCopy({
      editionId: result.editionId,
      medium: "physical",
      quantity: Number(flag("quantity") ?? 1),
      location: flag("where") ?? null,
    })
  }

  console.log(
    `${wishlist ? "Wishlisted" : "Added"} "${book.title}" by ${book.authors.join(", ") || "unknown"} ` +
      `(work ${result.workId}, edition ${result.editionId}${result.reusedEdition ? ", reused" : ""})`
  )
}

main()
