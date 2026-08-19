"use client"

import type { WorkDetail } from "@/db/queries/works"
import { AddEditionDialog } from "./edition-dialog"
import { EditionCard } from "./edition-card"

export function EditionList({ work }: { work: WorkDetail }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl font-medium">The copies you have</h2>
          <p className="text-muted-foreground text-sm">
            One edition per printing; one copy per book you actually hold.
          </p>
        </div>
        <AddEditionDialog workId={work.id} />
      </div>

      {work.editions.length === 0 ? (
        <p className="text-muted-foreground bg-card rounded-2xl border border-dashed p-6 text-sm">
          No editions recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {work.editions.map((edition) => (
            <EditionCard key={edition.id} workId={work.id} edition={edition} />
          ))}
        </div>
      )}
    </section>
  )
}
