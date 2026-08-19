import { cn } from "@/lib/utils"

/**
 * The wooden rail a row of covers stands on. It is the one piece of skeuomorph
 * in the app and it earns its place: it is what turns a grid of thumbnails into
 * something you recognise as your own bookshelf, which is the whole promise of
 * the name.
 *
 * The rail is drawn wider than the content and sits behind it, so covers of
 * different heights all appear to rest on the same plank.
 */
export function Shelf({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative pb-5", className)}>
      {children}
      <div
        aria-hidden
        className="from-shelf-wood-top to-shelf-wood-bottom absolute right-[-10px] bottom-0 left-[-10px] h-2 rounded-[2px] bg-linear-to-b shadow-[0_5px_12px_-5px_rgb(60_40_20/0.55)]"
      />
    </div>
  )
}
