export type Role = "admin" | "user"

/** The subset of the user record carried in the session cookie and exposed to the client. */
export type SessionUser = {
  id: number
  username: string
  displayName: string
  role: Role
  /**
   * True while an admin-set temporary password is still in place. Carried in the
   * cookie so the layout can force the change without a query on every render;
   * the cookie is reissued the moment the password is changed.
   */
  mustChangePassword: boolean
}
