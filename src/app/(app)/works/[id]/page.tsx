import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Check, Heart, Pencil } from "lucide-react"

import { requireUser } from "@/lib/auth"
import { getWorkDetail, type WorkDetail } from "@/db/queries/works"
import { BookCover } from "@/components/book-cover"
import { Button } from "@/components/ui/button"
import { formatLabel } from "@/lib/labels"
import { EditionList } from "./components/edition-list"
import { ReadingPanel } from "./components/reading-panel"
import { WorkActions } from "./components/work-actions"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const work = getWorkDetail(Number(id))
  return { title: work ? `${work.title} — Librero` : "Not found — Librero" }
}

/*
 * The three lines on the card tucked under the cover, in the shape a library
 * would write them: a call number built from subject, author and year, then the
 * ISBN, then where the thing actually is. It is decoration that happens to be
 * the fastest way to answer "which one is this?".
 */
function callNumber(work: WorkDetail): string {
  const subject = work.tags[0]?.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 3)
  const nameParts = work.authors[0]?.name.split(/\s+/) ?? []
  const surname = nameParts[nameParts.length - 1]?.toUpperCase().slice(0, 3)
  return [subject, surname, work.firstPublishYear].filter(Boolean).join(" · ")
}

/** "paperback ×2 in the study, hardcover in the living room." */
function whereItIs(work: WorkDetail): string {
  const parts = work.editions.flatMap((edition) =>
    edition.copies.map((copy) => {
      const count = copy.quantity > 1 ? ` ×${copy.quantity}` : ""
      const where = copy.location ? ` in the ${copy.location.toLowerCase()}` : ""
      return `${formatLabel(edition.format).toLowerCase()}${count}${where}`
    })
  )
  return parts.join(", ")
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()

  const { id } = await params
  const workId = Number(id)
  if (!Number.isInteger(workId)) notFound()

  const work = getWorkDetail(workId)
  if (!work) notFound()

  const primary = work.editions.find((edition) => edition.coverPath) ?? work.editions[0]
  const totalCopies = work.editions.reduce(
    (sum, edition) => sum + edition.copies.reduce((n, copy) => n + copy.quantity, 0),
    0
  )
  const locations = [
    ...new Set(
      work.editions.flatMap((edition) =>
        edition.copies.map((copy) => copy.location).filter(Boolean)
      )
    ),
  ] as string[]

  return (
    <div className="flex max-w-[1060px] flex-col gap-6.5 px-4 lg:px-7">
      <Link
        href={work.isWishlist ? "/wishlist" : "/library"}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-[13px]"
      >
        <ArrowLeft className="size-3.5" />
        {work.isWishlist ? "Back to the wishlist" : "Back to the shelves"}
      </Link>

      <div className="grid gap-9 md:grid-cols-[220px_1fr] md:items-start">
        <div className="flex flex-col gap-3.5">
          <BookCover
            coverPath={primary?.coverPath ?? null}
            title={work.title}
            className="shadow-[0_26px_40px_-26px_rgb(60_40_20/0.9)] dark:shadow-[0_26px_40px_-26px_rgb(0_0_0/0.9)]"
          />

          {/* A borrower's card: ruled paper, typewriter face, three facts. */}
          <div
            className="bg-card text-muted-foreground rounded-lg border px-3.5 py-2.5 font-mono text-[11px] leading-[26px]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(var(--card) 0 25px, var(--border) 25px 26px)",
              backgroundPosition: "0 10px",
            }}
          >
            <div>{callNumber(work) || "Uncatalogued"}</div>
            <div>{primary?.isbn13 ?? primary?.isbn10 ?? "No ISBN"}</div>
            <div>
              {locations.length > 0 ? `${locations.join(", ")} · ` : ""}
              {totalCopies} {totalCopies === 1 ? "copy" : "copies"}
              {/* Only worth saying when the two numbers differ — "2 copies · 1
                  edition" is noise, "2 copies · 2 editions" is the whole point
                  of modelling editions separately. */}
              {work.editions.length > 1
                ? ` · ${work.editions.length} editions`
                : ""}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <h1 className="font-serif text-[42px] leading-[1.05] font-medium tracking-[-0.01em]">
                {work.title}
              </h1>
              {work.subtitle ? (
                <p className="text-muted-foreground font-serif mt-1 text-lg">
                  {work.subtitle}
                </p>
              ) : null}
              <p className="font-serif mt-2 text-lg">
                {work.authors.map((author) => author.name).join(", ")}
                {work.firstPublishYear || work.series.length > 0 ? (
                  <span className="text-muted-foreground">
                    {work.firstPublishYear ? ` · ${work.firstPublishYear}` : ""}
                    {work.series
                      .map(
                        (s) => ` · ${s.name}${s.position !== null ? ` #${s.position}` : ""}`
                      )
                      .join("")}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/works/${work.id}/edit`}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
              <WorkActions workId={work.id} isWishlist={work.isWishlist} />
            </div>
          </div>

          {/* The verdict, in the same voice the bookshop check uses. */}
          {work.isWishlist ? (
            <p className="inline-flex w-fit items-center gap-2.5 rounded-full bg-[oklch(0.93_0.04_300)] px-4 py-2.5 text-sm text-[oklch(0.36_0.09_300)] dark:bg-[oklch(0.3_0.06_300)] dark:text-[oklch(0.9_0.05_300)]">
              <Heart className="size-4.5 shrink-0" strokeWidth={2.2} />
              <span>
                <strong className="font-semibold">On your wishlist</strong> — wanted, not
                owned.
              </span>
            </p>
          ) : totalCopies > 0 ? (
            <p className="inline-flex w-fit items-center gap-2.5 rounded-full bg-[oklch(0.93_0.045_145)] px-4 py-2.5 text-sm text-[oklch(0.36_0.08_150)] dark:bg-[oklch(0.3_0.06_150)] dark:text-[oklch(0.9_0.06_150)]">
              <Check className="size-4.5 shrink-0" strokeWidth={2.2} />
              <span>
                <strong className="font-semibold">On your shelf</strong>
                {whereItIs(work) ? ` — ${whereItIs(work)}.` : "."}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground bg-muted inline-flex w-fit rounded-full px-4 py-2.5 text-sm">
              You have the edition details but not the book.
            </p>
          )}

          {work.description ? (
            <p className="font-serif max-w-[62ch] text-[17px] leading-[1.65] whitespace-pre-line">
              {work.description}
            </p>
          ) : null}

          {work.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {work.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="bg-muted text-muted-foreground rounded-full px-2.75 py-0.75 text-xs"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}

          <ReadingPanel work={work} pageCount={primary?.pageCount ?? null} />

          <div id="editions" className="scroll-mt-20">
            <EditionList work={work} />
          </div>
        </div>
      </div>
    </div>
  )
}
