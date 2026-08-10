import Link from "next/link"
import { AlertTriangle, Check, Heart, MapPin, Plus } from "lucide-react"

import type { OwnershipCheck } from "@/lib/ownership"
import { Badge } from "@/components/ui/badge"
import { formatLabel } from "@/lib/labels"
import { cn } from "@/lib/utils"

/*
 * Read at arm's length in a bookshop, on a phone, one-handed. Colour carries
 * the verdict but never alone — each state has its own icon and its own words.
 */
const STYLES = {
  OWNED_SAME_EDITION: {
    icon: Check,
    heading: "You already own this",
    tone: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
    accent: "text-red-600 dark:text-red-400",
  },
  OWNED_OTHER_EDITION: {
    icon: AlertTriangle,
    heading: "You own a different edition",
    tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    accent: "text-amber-600 dark:text-amber-400",
  },
  ON_WISHLIST: {
    icon: Heart,
    heading: "On your wishlist",
    tone: "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100",
    accent: "text-violet-600 dark:text-violet-400",
  },
  NOT_OWNED: {
    icon: Plus,
    heading: "Not on your shelf",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
} as const

export function OwnershipBadge({
  ownership,
  className,
}: {
  ownership: OwnershipCheck
  className?: string
}) {
  const style = STYLES[ownership.verdict]
  const Icon = style.icon

  return (
    <div className={cn("rounded-lg border p-3", style.tone, className)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-5 shrink-0", style.accent)} />
        <p className="text-base font-semibold">{style.heading}</p>
      </div>

      {ownership.ownedEditions.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm">
          {ownership.ownedEditions.map((edition) => (
            <li key={edition.editionId} className="flex flex-wrap items-center gap-1.5">
              <Badge variant={edition.isMatch ? "default" : "secondary"}>
                {formatLabel(edition.format)}
              </Badge>
              {edition.copyCount > 1 ? <span>×{edition.copyCount}</span> : null}
              {edition.publishYear ? (
                <span className="opacity-75">
                  {edition.publisher ? `${edition.publisher}, ` : ""}
                  {edition.publishYear}
                </span>
              ) : null}
              {edition.editionNote ? (
                <span className="italic opacity-75">{edition.editionNote}</span>
              ) : null}
              {edition.locations.length > 0 ? (
                <span className="inline-flex items-center gap-1 opacity-75">
                  <MapPin className="size-3" />
                  {edition.locations.join(", ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {ownership.workId ? (
        <Link
          href={`/works/${ownership.workId}`}
          className="mt-2 inline-block text-sm underline underline-offset-4"
        >
          Open {ownership.workTitle}
        </Link>
      ) : null}
    </div>
  )
}
