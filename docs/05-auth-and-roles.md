# 05 — Authentication and roles

## What this needs to be

One shared household library. Username and password. Two roles. No OAuth, no email, no
password-reset flow, no third-party identity provider.

That is small enough that a dependency costs more than it saves — particularly Auth.js v5,
which is still beta and unproven on Next 16. The whole implementation is
`src/lib/session.ts` plus `src/lib/auth.ts`, about 120 lines. If OAuth is ever wanted, it
is those two files that change and nothing else.

## Sessions

A signed JWT in an HTTP-only cookie.

| | |
| --- | --- |
| Cookie | `librero_session` |
| Signing | HS256 via `jose`, key from `SESSION_SECRET` (≥32 characters, enforced at startup) |
| Lifetime | 30 days |
| Flags | `httpOnly`, `sameSite=lax`, `secure` in production, `path=/` |
| Payload | `{ sub: id, username, displayName, role, mustChangePassword }` |

The payload is deliberately small and deliberately not authoritative about anything that
can change silently. It carries `role` and `mustChangePassword` so the layout does not
need a database round trip on every render; both are re-issued the moment they change
(`changePassword` writes a fresh cookie immediately).

There is no server-side session table, so there is no global "sign out everywhere".
Rotating `SESSION_SECRET` invalidates every session at once, which is the blunt version of
the same thing.

## Passwords

argon2id via `@node-rs/argon2`, at the OWASP interactive baseline: 19 MiB memory cost,
2 iterations, 1 lane. Minimum length 10 characters, no composition rules — length is what
matters.

Two details in `login`:

- **The error message is identical** whether the username is unknown or the password is
  wrong. Distinguishing them hands out a list of valid usernames.
- **A missing user still pays for a hash.** `hashPassword(password)` runs on the
  not-found path so response time does not reveal whether an account exists.

## The three guards

```ts
requireUser()    // page/layout: redirects to /login
requireAdmin()   // page/layout: redirects to /errors/forbidden
assertUser()     // Server Action: throws AuthorizationError, caught and shown as a toast
assertAdmin()    // Server Action: same, admin-only
```

Pages redirect because a redirect is the right response to a browser navigation. Server
Actions throw because the form needs to show a message, not navigate away.

**Every** Server Action opens with one of these. The middleware redirect and the hidden
sidebar link are conveniences; they are not the boundary.

## The middleware is not the boundary

`src/proxy.ts` (Next 16's rename of `middleware.ts`) only checks that the session cookie
*exists*. It does not verify the signature, because that would mean the signing key on the
edge runtime and a verification on literally every request including static assets.

So: a forged cookie gets past the proxy and is rejected by `requireUser()` a few
milliseconds later. The proxy exists to give signed-out visitors a clean redirect, not to
authorize anything.

API routes are excluded from the matcher entirely — they must answer with a 401 in JSON,
never an HTML redirect — and each does its own `getSession()` check.

## Roles

| | Users | Administrators |
| --- | --- | --- |
| Browse, search, scan | ✓ | ✓ |
| Add, edit, delete books, editions, copies | ✓ | ✓ |
| Import and export CSV | ✓ | ✓ |
| Create, delete, reset and re-role accounts | | ✓ |

The library is shared, so there is no per-book ownership to enforce. The only asymmetry is
account management.

Three invariants in `src/actions/users.ts`, all enforced server-side:

1. You cannot delete your own account.
2. You cannot remove your own admin role.
3. The last administrator cannot be demoted or deleted — the instance must never be left
   with no way to manage users.

## First run

On an empty `users` table, the Docker entrypoint (or `npm run seed:admin`) creates one
administrator from `ADMIN_USERNAME` / `ADMIN_PASSWORD` with `must_change_password = true`.
It is idempotent: if any user exists it does nothing, so it is safe on every boot.

A user holding a temporary password can reach exactly one page. `(app)/layout.tsx`
redirects them to `/first-run`, which sits outside the app shell and offers only the
change-password form. The same applies after an administrator resets someone's password.

## What this does not defend against

Worth stating plainly:

- **No rate limiting on login.** A determined attacker with network access to the instance
  can brute-force. argon2's cost makes that slow, but the real mitigation is not exposing
  Librero to the open internet — put it behind Tailscale, or a VPN, or your LAN.
- **No CSRF token.** Next's Server Actions are POST-only with an origin check and the
  cookie is `sameSite=lax`, which covers the ordinary cases.
- **No audit log.** `last_login_at` is the only trace of who did what.
