"use client"

import * as React from "react"
import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { Heart, MoreHorizontal, Trash2 } from "lucide-react"

import { removeWork, toggleWishlist, type BookActionState } from "@/actions/books"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function WorkActions({
  workId,
  isWishlist,
}: {
  workId: number
  isWishlist: boolean
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const [wishlistState, wishlistAction] = useActionState<BookActionState, FormData>(
    toggleWishlist,
    {}
  )
  const [deleteState, deleteAction] = useActionState<BookActionState, FormData>(
    removeWork,
    {}
  )

  useActionFeedback(wishlistState)
  useActionFeedback(deleteState, () => {
    setConfirmOpen(false)
    router.push("/library")
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()}>
            <form action={wishlistAction} className="w-full">
              <input type="hidden" name="workId" value={workId} />
              <button type="submit" className="flex w-full items-center gap-2">
                <Heart className="size-4" />
                {isWishlist ? "Move to my library" : "Move to wishlist"}
              </button>
            </form>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Delete book
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <form action={deleteAction}>
            <input type="hidden" name="workId" value={workId} />
            <DialogHeader>
              <DialogTitle>Delete this book?</DialogTitle>
              <DialogDescription>
                Its editions, copies and any uploaded ebook files go with it. This cannot
                be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive" pendingLabel="Deleting…">
                Delete
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
