"use client"

import * as React from "react"
import Link from "next/link"
import { ScanBarcode } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { CommandSearch, SearchTrigger } from "@/components/command-search"
import { ModeToggle } from "@/components/mode-toggle"

export function SiteHeader() {
  const [searchOpen, setSearchOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <>
      <header className="bg-header flex h-(--header-height) w-full shrink-0 items-center gap-2 overflow-hidden border-b px-3 transition-[width,height] ease-linear sm:gap-3 sm:px-4 lg:px-7">
        <SidebarTrigger className="-ml-1 shrink-0" />

        <SearchTrigger onClick={() => setSearchOpen(true)} />

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          {/* The one line of copy that says what this app is for. */}
          <span className="text-muted-foreground font-serif hidden text-sm italic lg:inline">
            In a bookshop?
          </span>
          <Button asChild size="sm" className="h-8.5 rounded-full px-4">
            <Link href="/search">
              <ScanBarcode />
              <span className="hidden sm:inline">Scan a book</span>
            </Link>
          </Button>
          <ModeToggle />
        </div>
      </header>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
