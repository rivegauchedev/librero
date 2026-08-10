import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"

import { requireUser } from "@/lib/auth"
import { getWorkDetail } from "@/db/queries/works"
import { BookCover } from "@/components/book-cover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()

  const { id } = await params
  const workId = Number(id)
  if (!Number.isInteger(workId)) notFound()

  const work = getWorkDetail(workId)
  if (!work) notFound()

  const cover = work.editions.find((edition) => edition.coverPath)?.coverPath ?? null
  const totalCopies = work.editions.reduce(
    (sum, edition) => sum + edition.copies.reduce((n, copy) => n + copy.quantity, 0),
    0
  )

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={work.isWishlist ? "/wishlist" : "/library"}>
            <ArrowLeft />
            {work.isWishlist ? "Wishlist" : "My books"}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-40 shrink-0">
          <BookCover coverPath={cover} title={work.title} />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{work.title}</h1>
              {work.subtitle ? (
                <p className="text-muted-foreground text-lg">{work.subtitle}</p>
              ) : null}
              {work.authors.length > 0 ? (
                <p className="mt-1">
                  {work.authors.map((author) => author.name).join(", ")}
                </p>
              ) : null}
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

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {work.isWishlist ? <Badge variant="secondary">Wishlist</Badge> : null}
            {work.firstPublishYear ? (
              <span className="text-muted-foreground">
                First published {work.firstPublishYear}
              </span>
            ) : null}
            {work.series.map((series) => (
              <Badge key={series.id} variant="outline">
                {series.name}
                {series.position !== null ? ` #${series.position}` : ""}
              </Badge>
            ))}
          </div>

          {!work.isWishlist ? (
            <p className="text-muted-foreground text-sm">
              {totalCopies === 0
                ? "No copies recorded — you have the edition details but not the book."
                : `${totalCopies} ${totalCopies === 1 ? "copy" : "copies"} across ${work.editions.length} ${work.editions.length === 1 ? "edition" : "editions"}.`}
            </p>
          ) : null}

          {work.description ? (
            <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line">
              {work.description}
            </p>
          ) : null}

          {work.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {work.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="font-normal">
                  {tag.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Separator />

      <ReadingPanel work={work} />

      <Separator />

      <EditionList work={work} />
    </div>
  )
}
