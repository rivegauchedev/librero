"use client"

import { Check, Monitor, Moon, Sun } from "lucide-react"

import { useTheme } from "@/hooks/use-theme"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match system", icon: Monitor },
] as const

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6 px-4 lg:px-7">
      <div>
        <h1 className="font-serif text-3xl font-medium">Appearance</h1>
        <p className="text-muted-foreground">How Librero looks on this device.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Stored in this browser, so each device can differ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {OPTIONS.map((option) => {
              const selected = theme === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={selected}
                  className={cn(
                    "hover:border-accent-foreground/30 flex items-center gap-3 rounded-md border-2 p-4 text-left transition-colors",
                    selected ? "border-primary" : "border-muted"
                  )}
                >
                  <option.icon className="size-5 shrink-0" />
                  <span className="flex-1 text-sm font-medium">{option.label}</span>
                  {selected ? <Check className="text-primary size-4" /> : null}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
