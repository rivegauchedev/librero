"use client"

import * as React from "react"
import { AppSidebar, type NavCounts } from "@/components/app-sidebar"
import type { Room } from "@/components/nav-rooms"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useSidebarConfig } from "@/hooks/use-sidebar-config"

export function AppShell({
  counts,
  rooms,
  children,
}: {
  counts: NavCounts
  rooms: Room[]
  children: React.ReactNode
}) {
  const { config } = useSidebarConfig()

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "15rem",
          "--sidebar-width-icon": "3rem",
          "--header-height": "3.75rem",
        } as React.CSSProperties
      }
      className={config.collapsible === "none" ? "sidebar-none-mode" : ""}
    >
      <AppSidebar
        variant={config.variant}
        collapsible={config.collapsible}
        counts={counts}
        rooms={rooms}
      />
      {/*
        `min-w-0` because a flex item defaults to min-width:auto, which is its
        content's min-content width — and the header's buttons are shrink-0, so
        that floor sits above the space left beside the sidebar. Without this
        the inset refuses to shrink and the whole page scrolls sideways in the
        band just above the mobile breakpoint.
      */}
      <SidebarInset className="min-w-0">
        <SiteHeader />
        <div className="@container/main flex flex-1 flex-col py-7">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
