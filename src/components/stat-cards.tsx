import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type Stat = {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
}

/**
 * The template's dashboard card treatment, driven by real numbers. Kept generic
 * so the overview and the admin screens share one look.
 */
export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="@container/card">
          <CardHeader>
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {stat.value}
            </CardTitle>
            {stat.icon ? (
              <CardAction>
                <stat.icon className="text-muted-foreground size-5" />
              </CardAction>
            ) : null}
            {stat.hint ? (
              <CardDescription className="text-xs">{stat.hint}</CardDescription>
            ) : null}
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
