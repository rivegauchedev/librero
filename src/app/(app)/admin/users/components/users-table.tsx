"use client"

import * as React from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import type { ColumnDef } from "@tanstack/react-table"
import { KeyRound, MoreHorizontal, Shield, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"

import {
  changeUserRole,
  createUser,
  deleteUser,
  resetUserPassword,
  type UserActionState,
} from "@/actions/users"
import { DataTable, DataTableColumnHeader } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type UserRow = {
  id: number
  username: string
  displayName: string
  role: "admin" | "user"
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working…" : children}
    </Button>
  )
}

/** Shows the action result as a toast and closes the dialog on success. */
function useActionToast(state: UserActionState, onSuccess: () => void) {
  React.useEffect(() => {
    if (state.error) toast.error(state.error)
    if (state.success) {
      toast.success(state.success)
      onSuccess()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per new state object
  }, [state])
}

function AddUserDialog() {
  const [open, setOpen] = React.useState(false)
  const [state, action] = useActionState<UserActionState, FormData>(createUser, {})
  useActionToast(state, () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={action}>
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>
              They will be asked to choose a new password the first time they sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" autoCapitalize="none" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" name="password" type="text" minLength={10} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue="user">
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User — add and edit books</SelectItem>
                  <SelectItem value="admin">Administrator — also manages users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <SubmitButton>Create user</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [state, action] = useActionState<UserActionState, FormData>(
    resetUserPassword,
    {}
  )
  useActionToast(state, () => onOpenChange(false))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={action}>
          <input type="hidden" name="userId" value={user.id} />
          <DialogHeader>
            <DialogTitle>Reset password for {user.username}</DialogTitle>
            <DialogDescription>
              Give them this password out of band; they must change it at next sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" name="password" type="text" minLength={10} required />
          </div>
          <DialogFooter>
            <SubmitButton>Reset password</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [state, action] = useActionState<UserActionState, FormData>(deleteUser, {})
  useActionToast(state, () => onOpenChange(false))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={action}>
          <input type="hidden" name="userId" value={user.id} />
          <DialogHeader>
            <DialogTitle>Delete {user.username}?</DialogTitle>
            <DialogDescription>
              The library is shared, so their books stay. Only the account is removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              Delete account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RoleToggle({ user }: { user: UserRow }) {
  const [state, action] = useActionState<UserActionState, FormData>(changeUserRole, {})
  useActionToast(state, () => {})
  const nextRole = user.role === "admin" ? "user" : "admin"

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="role" value={nextRole} />
      <button type="submit" className="flex w-full items-center gap-2">
        <Shield className="size-4" />
        {user.role === "admin" ? "Make regular user" : "Make administrator"}
      </button>
    </form>
  )
}

function RowActions({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [resetOpen, setResetOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="size-8 p-0">
            <MoreHorizontal />
            <span className="sr-only">Actions for {user.username}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRound />
            Reset password
          </DropdownMenuItem>
          {isSelf ? null : (
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <div className="cursor-pointer">
                <RoleToggle user={user} />
              </div>
            </DropdownMenuItem>
          )}
          {isSelf ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 />
                Delete account
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ResetPasswordDialog user={user} open={resetOpen} onOpenChange={setResetOpen} />
      <DeleteUserDialog user={user} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  )
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[]
  currentUserId: number
}) {
  const columns = React.useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: "displayName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.displayName}</span>
            <span className="text-muted-foreground text-xs">@{row.original.username}</span>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
        cell: ({ row }) => (
          <Badge variant={row.original.role === "admin" ? "default" : "secondary"}>
            {row.original.role === "admin" ? "Administrator" : "User"}
          </Badge>
        ),
        filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
      },
      {
        accessorKey: "lastLoginAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last sign-in" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatDate(row.original.lastLoginAt)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Added" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "status",
        header: "",
        cell: ({ row }) =>
          row.original.mustChangePassword ? (
            <Badge variant="outline">Password reset pending</Badge>
          ) : null,
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <RowActions user={row.original} isSelf={row.original.id === currentUserId} />
        ),
      },
    ],
    [currentUserId]
  )

  return (
    <DataTable
      columns={columns}
      data={users}
      searchColumn="displayName"
      searchPlaceholder="Search users…"
      facets={[
        {
          column: "role",
          title: "Role",
          options: [
            { label: "Administrator", value: "admin" },
            { label: "User", value: "user" },
          ],
        },
      ]}
      actions={<AddUserDialog />}
      emptyMessage="No users yet."
    />
  )
}
