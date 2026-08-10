import Link from "next/link"
import { Check, Heart, MapPin } from "lucide-react"

import type { ShelfMatch } from "@/app/api/lookup/route"
import { BookCover } from "@/components/book-cover"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatLabel } from "@/lib/labels"

/** A hit from your own catalogue — the direct answer to "do I have this?". */
export function ShelfMatchCard({ match }: { match: ShelfMatch }) {
  const owned = !match.isWishlist

  return (
    <Card
      className={
        owned
          ? "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20"
          : "border-violet-300 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20"
      }
    >
      <CardContent className="flex gap-4">
        <BookCover
          coverPath={match.coverPath}
          title={match.title}
          className="h-24 w-16 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {owned ? (
              <>
                <Check className="size-4 text-red-600 dark:text-red-400" />
                On your shelf
              </>
            ) : (
              <>
                <Heart className="size-4 text-violet-600 dark:text-violet-400" />
                On your wishlist
              </>
            )}
          </p>

          <Link
            href={`/works/${match.workId}`}
            className="mt-0.5 block leading-tight font-medium underline-offset-4 hover:underline"
          >
            {match.title}
          </Link>
          {match.authors ? (
            <p className="text-muted-foreground text-sm">{match.authors}</p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            {match.formats.map((format) => (
              <Badge key={format} variant="secondary">
                {formatLabel(format)}
              </Badge>
            ))}
            {match.copyCount > 1 ? <span>×{match.copyCount}</span> : null}
            {match.locations.length > 0 ? (
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {match.locations.join(", ")}
              </span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
