"use client"

import * as React from "react"
import type { SessionUser } from "@/lib/session-types"

const SessionContext = React.createContext<SessionUser | null>(null)

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser
  children: React.ReactNode
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
}

/** Read the signed-in user. Only valid inside the (app) layout, which always has a session. */
export function useSession(): SessionUser {
  const user = React.useContext(SessionContext)
  if (!user) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return user
}
