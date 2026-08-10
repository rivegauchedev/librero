import type { LucideIcon } from "lucide-react"

export type FacetOption = {
  label: string
  value: string
  icon?: LucideIcon
}

export type FacetConfig = {
  /** Column id the filter applies to. */
  column: string
  title: string
  options: FacetOption[]
}
