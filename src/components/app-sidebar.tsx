"use client"

import * as React from "react"
import {
  HandHelping,
  Heart,
  LayoutDashboard,
  Library,
  ScanBarcode,
  Settings,
  Upload,
  Users,
} from "lucide-react"
import Link from "next/link"

import { Logo } from "@/components/logo"
import { NavMain } from "@/components/nav-main"
import { NavRooms, type Room } from "@/components/nav-rooms"
import { NavUser } from "@/components/nav-user"
import { useSession } from "@/components/session-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type NavCounts = {
  works: number
  wishlist: number
  onLoan: number
}

export function AppSidebar({
  counts,
  rooms,
  ...props
}: React.ComponentProps<typeof Sidebar> & { counts: NavCounts; rooms: Room[] }) {
  const user = useSession()

  /*
   * Counts only ride on the destinations where a number means something: how
   * many books you have, how many you want, how many are out of the house.
   * "Check a book" and "Bring books in" are verbs, not places, so they get none.
   */
  const shelvesGroup = {
    label: "The shelves",
    items: [
      { title: "Reading room", url: "/", icon: LayoutDashboard },
      { title: "Check a book", url: "/search", icon: ScanBarcode },
      { title: "The shelves", url: "/library", icon: Library, count: counts.works },
      { title: "Wanted", url: "/wishlist", icon: Heart, count: counts.wishlist },
      { title: "Lent out", url: "/loans", icon: HandHelping, count: counts.onLoan },
      { title: "Bring books in", url: "/import", icon: Upload },
    ],
  }

  const accountGroup = {
    label: "Account",
    items: [
      {
        title: "Settings",
        url: "#",
        icon: Settings,
        items: [
          { title: "Account", url: "/settings/account" },
          { title: "Appearance", url: "/settings/appearance" },
        ],
      },
    ],
  }

  const adminGroup = {
    label: "Administration",
    items: [{ title: "Users", url: "/admin/users", icon: Users }],
  }

  const tailGroups = user.role === "admin" ? [adminGroup, accountGroup] : [accountGroup]

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="h-12">
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8.5 items-center justify-center rounded-[10px] shadow-[inset_0_-1px_0_rgb(0_0_0/0.15)]">
                  <Logo size={20} className="text-current" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="font-serif truncate text-xl font-medium tracking-[0.01em]">
                    Librero
                  </span>
                  <span className="text-muted-foreground font-serif truncate text-[11px] italic">
                    tu librero personal
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label={shelvesGroup.label} items={shelvesGroup.items} />
        {rooms.length > 0 ? <NavRooms rooms={rooms} /> : null}
        {tailGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
