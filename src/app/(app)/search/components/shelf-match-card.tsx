import Link from "next/link"
import { Check, Heart, MapPin } from "lucide-react"

import type { ShelfMatch } from "@/app/api/lookup/route"
import { BookCover } from "@/components/book-cover"
import { Button } from "@/components/ui/button"
import { formatLabel } from "@/lib/labels"

/**
 * A hit from your own catalogue — the direct answer to "do I have this?".
 *
 * This is the one screen read at arm's length, on a phone, in a shop, with
 * someone waiting. So the verdict gets a full-width band of its own colour and
 * a sentence in 30px type; everything you might want *after* deciding sits
 * quietly underneath it.
 */
export function ShelfMatchCard({ match }: { match: ShelfMatch }) {
  const owned = !match.isWishlist

  const banner = owned
    ? {
        icon: Check,
        verdict: "Yes — it's already yours",
        aside: "Put it back down, gently.",
        band: "bg-[oklch(0.44_0.13_30)] text-[oklch(0.98_0.009_262)]",
        edge: "border-[oklch(0.82_0.09_30)] dark:border-[oklch(0.45_0.1_30)]",
      }
    : {
        icon: Heart,
        verdict: "You wanted this one",
        aside: "It is on your wishlist, not your shelf.",
        band: "bg-[oklch(0.44_0.11_300)] text-[oklch(0.98_0.009_262)]",
        edge: "border-[oklch(0.82_0.08_300)] dark:border-[oklch(0.45_0.09_300)]",
      }

  const Icon = banner.icon

  return (
    <div className={`bg-card overflow-hidden rounded-[18px] border ${banner.edge}`}>
      <div className={`flex items-center gap-3.5 px-6.5 py-5.5 ${banner.band}`}>
        <Icon className="size-7.5 shrink-0" strokeWidth={2.4} />
        <div>
          <p className="font-serif text-3xl leading-tight font-medium">
            {banner.verdict}
          </p>
          <p className="mt-1 text-sm opacity-80">{banner.aside}</p>
        </div>
      </div>

      <div className="flex gap-4.5 px-6.5 py-5.5">
        <BookCover
          coverPath={match.coverPath}
          title={match.title}
          className="w-21 shrink-0"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div>
            <p className="font-serif text-[22px] leading-tight font-medium">
              {match.title}
            </p>
            {match.authors ? (
              <p className="text-muted-foreground mt-0.5 text-sm">{match.authors}</p>
            ) : null}
          </div>

          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span>{match.formats.map(formatLabel).join(" · ") || "No copies recorded"}</span>
            {match.copyCount > 1 ? (
              <span className="text-muted-foreground">×{match.copyCount}</span>
            ) : null}
            {match.locations.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="text-muted-foreground size-4" />
                <strong className="font-semibold">{match.locations.join(", ")}</strong>
              </span>
            ) : null}
          </p>

          <div className="flex flex-wrap gap-2 pt-0.5">
            <Button asChild size="sm" variant="outline">
              <Link href={`/works/${match.workId}`}>Open its page</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/works/${match.workId}#editions`}>
                {owned ? "Add another copy anyway" : "Add it to the shelf"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
