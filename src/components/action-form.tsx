"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type ActionResult = { error?: string; success?: string }

/**
 * Every Server Action in Librero returns `{ error?, success? }`. This surfaces
 * that as a toast, so no form has to repeat the same effect.
 */
export function useActionFeedback(
  state: ActionResult,
  onSuccess?: () => void
): void {
  // The callback is held in a ref so the effect depends only on `state` — a new
  // inline closure on every render would otherwise re-fire the toast. The ref
  // is written inside an effect, never during render.
  const callback = React.useRef(onSuccess)

  React.useEffect(() => {
    callback.current = onSuccess
  })

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
    if (state.success) {
      toast.success(state.success)
      callback.current?.()
    }
  }, [state])
}

/** Submit button that shows pending state from the enclosing form. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  )
}
