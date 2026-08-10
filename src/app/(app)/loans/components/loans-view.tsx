"use client"

import Link from "next/link"
import { useActionState } from "react"

import { markLoanReturned, type LoanActionState } from "@/actions/loans"
import type { LoanListRow } from "@/db/queries/loans"
import { SubmitButton, useActionFeedback } from "@/components/action-form"
import { BookCover } from "@/components/book-cover"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { daysSince, formatDate } from "@/lib/dates"
import { formatLabel, mediumLabel } from "@/lib/labels"

function BookCell({ loan }: { loan: LoanListRow }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden w-10 shrink-0 sm:block">
        <BookCover coverPath={loan.coverPath} title={loan.title} />
      </div>
      <div className="min-w-0">
        <Link href={`/works/${loan.workId}`} className="font-medium hover:underline">
          {loan.title}
        </Link>
        {loan.authors ? (
          <p className="text-muted-foreground truncate text-xs">{loan.authors}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <Badge variant="outline" className="font-normal">
            {formatLabel(loan.format)}
          </Badge>
          <Badge
            variant={loan.medium === "digital" ? "secondary" : "outline"}
            className="font-normal"
          >
            {mediumLabel(loan.medium)}
          </Badge>
        </div>
      </div>
    </div>
  )
}

/* Each row owns its own action state, so one "mark returned" cannot spill its
   result onto the others — the same reason CopyRow is its own component. */
function OpenLoanRow({ loan }: { loan: LoanListRow }) {
  const [state, action] = useActionState<LoanActionState, FormData>(
    markLoanReturned,
    {}
  )
  useActionFeedback(state)

  const days = daysSince(loan.borrowedAt)

  return (
    <TableRow>
      <TableCell>
        <BookCell loan={loan} />
      </TableCell>
      <TableCell className="align-top font-medium">{loan.borrowerName}</TableCell>
      <TableCell className="text-muted-foreground align-top whitespace-nowrap">
        {formatDate(loan.borrowedAt)}
        <span className="block text-xs">
          {days === 0 ? "today" : days === 1 ? "1 day out" : `${days} days out`}
        </span>
      </TableCell>
      <TableCell className="align-top text-right">
        <form action={action}>
          {/* The work page shows this loan too, so it is revalidated from here. */}
          <input type="hidden" name="workId" value={loan.workId} />
          <input type="hidden" name="loanId" value={loan.id} />
          <SubmitButton
            variant="outline"
            size="sm"
            pendingLabel="Saving…"
            aria-label={`Mark ${loan.title} returned by ${loan.borrowerName}`}
          >
            Mark returned
          </SubmitButton>
        </form>
      </TableCell>
    </TableRow>
  )
}

export function OpenLoansTable({ loans }: { loans: LoanListRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Book</TableHead>
          <TableHead>Borrower</TableHead>
          <TableHead>Borrowed</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((loan) => (
          <OpenLoanRow key={loan.id} loan={loan} />
        ))}
      </TableBody>
    </Table>
  )
}

export function ReturnedLoansTable({ loans }: { loans: LoanListRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Book</TableHead>
          <TableHead>Borrower</TableHead>
          <TableHead>Returned</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((loan) => (
          <TableRow key={loan.id}>
            <TableCell>
              <BookCell loan={loan} />
            </TableCell>
            <TableCell className="align-top font-medium">{loan.borrowerName}</TableCell>
            <TableCell className="text-muted-foreground align-top whitespace-nowrap">
              {loan.returnedAt ? formatDate(loan.returnedAt) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
