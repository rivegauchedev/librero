/*
 * Dates are stored as unix seconds throughout. These are the two conversions
 * the UI needs; both are shared so the slicing and the ×1000 only exist once.
 */

/** Unix seconds to the `yyyy-mm-dd` an `<input type="date">` expects. */
export function toDateInput(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return ""
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

/** Today, in the same shape — the default for a "when did this happen" field. */
export function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString()
}

/** Whole days between then and now, floored at zero. */
export function daysSince(unixSeconds: number): number {
  const elapsed = Date.now() / 1000 - unixSeconds
  return Math.max(0, Math.floor(elapsed / 86_400))
}
