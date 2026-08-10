"use client"

import * as React from "react"
import { useActionState } from "react"
import { ChevronDown, HandHelping } from "lucide-react"

import { lendCopy, markLoanReturned, type LoanActionState } from "@/actions/loans"
import type { CopyDetail } from "@/db/queries/works"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, todayDateInput } from "@/lib/dates"

function LendDialog({ workId, copy }: { workId: number; copy: CopyDetail }) {
  const [open, setOpen] = React.useState(false)
  const [state, action] = useActionState<LoanActionState, FormData>(lendCopy, {})
  useActionFeedback(state, () => setOpen(false))

  // Several copies render on one page, so every field id is namespaced.
  const id = (field: string) => `loan-${copy.id}-${field}`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HandHelping className="size-4" />
          Lend
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form action={action}>
          <input type="hidden" name="workId" value={workId} />
          <input type="hidden" name="copyId" value={copy.id} />

          <DialogHeader>
            <DialogTitle>Lend this copy</DialogTitle>
            <DialogDescription>
              {copy.quantity > 1
                ? "One loan at a time is tracked per copy row — split it into separate copies to lend more than one."
                : "Who has it, and since when. Mark it returned when it comes back."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={id("borrower")}>Borrower</Label>
              <Input
                id={id("borrower")}
                name="borrowerName"
                required
                maxLength={120}
                placeholder="Who has it"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={id("borrowed")}>Borrowed</Label>
              <Input
                id={id("borrowed")}
                name="borrowedAt"
                type="date"
                defaultValue={todayDateInput()}
              />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={id("notes")}>Notes</Label>
              <Textarea id={id("notes")} name="notes" rows={2} />
            </div>
          </div>

          <DialogFooter>
            <SubmitButton pendingLabel="Lending…">Lend</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The lend / mark-returned control for one copy, plus its past loans. Split from
 * `CopyRow` because the badge belongs in the row's flow while the button belongs
 * in its action cluster — the caller places each piece.
 */
export function LoanControls({ workId, copy }: { workId: number; copy: CopyDetail }) {
  const [state, action] = useActionState<LoanActionState, FormData>(
    markLoanReturned,
    {}
  )
  useActionFeedback(state)

  const openLoan = copy.loans.find((loan) => loan.status === "pending")

  if (!openLoan) return <LendDialog workId={workId} copy={copy} />

  return (
    <form action={action}>
      <input type="hidden" name="workId" value={workId} />
      <input type="hidden" name="loanId" value={openLoan.id} />
      <SubmitButton
        variant="outline"
        size="sm"
        pendingLabel="Saving…"
        aria-label={`Mark returned by ${openLoan.borrowerName}`}
      >
        Mark returned
      </SubmitButton>
    </form>
  )
}

/** "Lent to Ana · since 3 Aug" — shown inline on the copy row while it is out. */
export function LoanBadge({ copy }: { copy: CopyDetail }) {
  const openLoan = copy.loans.find((loan) => loan.status === "pending")
  if (!openLoan) return null

  return (
    <span className="flex items-center gap-2">
      <Badge variant="secondary">Lent to {openLoan.borrowerName}</Badge>
      <span className="text-muted-foreground">
        since {formatDate(openLoan.borrowedAt)}
      </span>
    </span>
  )
}

export function LoanHistory({ copy }: { copy: CopyDetail }) {
  const past = copy.loans.filter((loan) => loan.status === "returned")
  if (past.length === 0) return null

  return (
    <Collapsible className="basis-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-auto px-1 py-0.5 text-xs"
        >
          <ChevronDown className="size-3.5" />
          Loan history ({past.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="text-muted-foreground pt-1 pl-2 text-xs">
          {past.map((loan) => (
            <li key={loan.id}>
              {loan.borrowerName} · {formatDate(loan.borrowedAt)} →{" "}
              {loan.returnedAt ? formatDate(loan.returnedAt) : "—"}
              {loan.notes ? ` · ${loan.notes}` : ""}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
