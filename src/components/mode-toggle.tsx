"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme"

interface ModeToggleProps {
  variant?: "outline" | "ghost" | "default"
}

export function ModeToggle({ variant = "outline" }: ModeToggleProps) {
  const { theme, setTheme } = useTheme()

  // `theme` may be "system", so the icon has to reflect what is actually
  // rendered, not what is stored.
  const [isDarkMode, setIsDarkMode] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const updateMode = () => {
      if (theme === "dark") setIsDarkMode(true)
      else if (theme === "light") setIsDarkMode(false)
      else setIsDarkMode(mediaQuery.matches)
    }

    updateMode()
    mediaQuery.addEventListener("change", updateMode)
    return () => mediaQuery.removeEventListener("change", updateMode)
  }, [theme])

  return (
    <Button
      variant={variant}
      size="icon"
      onClick={() => setTheme(isDarkMode ? "light" : "dark")}
      className="cursor-pointer"
    >
      {isDarkMode ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Switch to {isDarkMode ? "light" : "dark"} mode</span>
    </Button>
  )
}
