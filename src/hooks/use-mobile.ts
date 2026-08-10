import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * useSyncExternalStore rather than useState + useEffect: the viewport is an
 * external store, and subscribing to it directly avoids the extra render (and
 * the brief wrong value) that setting state inside an effect causes.
 */
function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // Server snapshot: assume desktop, matching the previous behaviour.
    () => false
  )
}
