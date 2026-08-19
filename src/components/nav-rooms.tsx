"use client"

import Link from "next/link"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type Room = {
  name: string
  /** Books in this room — the same unit the shelf rails count in. */
  books: number
  swatch: string
}

/**
 * Where the books physically are, read out of each copy's location. Clicking a
 * room deep-links into the shelves view filtered to it, so the sidebar answers
 * "what is in the study?" without a separate screen.
 */
export function NavRooms({ rooms }: { rooms: Room[] }) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Rooms</SidebarGroupLabel>
      <SidebarMenu>
        {rooms.map((room) => (
          <SidebarMenuItem key={room.name}>
            <SidebarMenuButton asChild size="sm" className="cursor-pointer">
              <Link href={`/library?room=${encodeURIComponent(room.name)}`}>
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ background: room.swatch }}
                />
                <span className="truncate">{room.name}</span>
                <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
                  {room.books}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
