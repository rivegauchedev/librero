"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Library,
  ScanBarcode,
  Heart,
  Upload,
  Users,
  Settings,
} from "lucide-react"
import Link from "next/link"

import { Logo } from "@/components/logo"
import { NavMain } from "@/components/nav-main"
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

const libraryGroup = {
  label: "Library",
  items: [
    { title: "Overview", url: "/", icon: LayoutDashboard },
    { title: "Check a book", url: "/search", icon: ScanBarcode },
    { title: "My books", url: "/library", icon: Library },
    { title: "Wishlist", url: "/wishlist", icon: Heart },
    { title: "Import", url: "/import", icon: Upload },
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useSession()
  const navGroups = user.role === "admin"
    ? [libraryGroup, adminGroup, accountGroup]
    : [libraryGroup, accountGroup]

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Logo size={20} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Librero</span>
                  <span className="truncate text-xs">Your bookshelf</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
