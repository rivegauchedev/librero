# 02 — Architecture

## Stack

| Concern | Choice | Why this one |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript | Server Components and Server Actions remove the need for a separate API layer; most pages are a query and some markup |
| Database | SQLite via `better-sqlite3` | One file. The synchronous driver means catalogue writes and their search-index updates can share a single transaction without async plumbing |
| ORM | Drizzle + `drizzle-kit` | Thin over SQL, with real migration files in the repo. Where a query is genuinely SQL-shaped (the aggregate joins in `src/db/queries/`) we write SQL and skip the ORM |
| Search | SQLite FTS5 | Title, author, series and ISBN in one index, with diacritic folding. No extra service |
| Auth | Hand-rolled: `jose`-signed JWT cookie + argon2id | The requirement is one username/password login with a role. Auth.js v5 is still beta on Next 16, and this is ~120 lines we fully control. See [05-auth-and-roles](05-auth-and-roles.md) |
| UI | Tailwind v4 + shadcn/ui, forked from the project design system | See below |
| Validation | Zod, shared by Server Actions and forms | |
| Tests | Vitest against a temp SQLite file | |

## What came from the design system

The UI is vendored from the ShadcnStore dashboard template (`nextjs-version/`), not a dependency —
shadcn components are meant to be owned and edited, and vendoring them means no upstream
break can take the app down.

**Kept and used:** the ~35 primitives in `src/components/ui/`, the sidebar shell
(`app-sidebar`, `nav-main`, `nav-user`, `site-header`, `sidebar-context`), the dark/light
theme provider, the error pages, and — most valuably — the TanStack Table toolkit, which
was promoted out of the template's demo "tasks" page into `src/components/data-table/` and
made generic. Both the library table and the admin users table use it.

**Removed:** the mail/chat/calendar/pricing/FAQ demo apps, the landing page, the tweakcn
theme customizer, and every mock JSON fixture. The dependencies they pulled in
(`@dnd-kit/*`, `recharts`, `zustand`, `react-resizable-panels`) went with them.

**Changed:** `components.json` pointed `tailwind.css` at `src/index.css`, a leftover from
the template's Vite variant; it now points at `src/app/globals.css` so `shadcn add` works.

## Request flow

A page render:

```
browser
  → proxy.ts            cookie present? if not, redirect to /login
  → (app)/layout.tsx    requireUser() verifies the JWT; forces /first-run if the
                        password is still the admin-issued temporary one
  → page.tsx            server component, queries SQLite synchronously
  → HTML
```

A mutation:

```
browser form
  → Server Action       assertUser() / assertAdmin()
  → Zod parse           FormData in, typed values out
  → src/db/mutations/   one sqlite.transaction(), FTS reindexed inside it
  → revalidatePath()
  → { error } | { success } → toast
```

The `proxy.ts` check is a convenience, not the boundary: it only checks that a cookie
*exists*, because verifying the signature needs the secret and it runs on every request.
Authorization is always `requireUser()` / `assertAdmin()` on the server.

## Directory map

```
src/
  actions/          Server Actions — auth, books, users, uploads, import
  app/
    (auth)/         login, first-run password change, error pages — no app shell
    (app)/          everything behind the login wall, wrapped in the sidebar shell
    api/            routes that must return non-HTML: covers, files, export,
                    lookup, library-search, health
  components/
    ui/             shadcn primitives (vendored)
    data-table/     generic TanStack table, promoted from the template
    …               book-card, ownership-badge, barcode-scanner, app shell
  db/
    schema.ts       Drizzle table definitions
    migrations/     generated SQL + one hand-written FTS5 migration
    queries/        reads (SQL, returning flat typed rows)
    mutations/      writes (transactional, FTS-aware)
    fts.ts          full-text index maintenance
  lib/
    providers/      Open Library + Google Books, normalization, merge, cache
    ownership.ts    the duplicate-detection logic
    isbn.ts         parsing, validation, ISBN-10 ↔ 13
    text.ts         normalization for sorting and fuzzy matching
    uploads.ts      ebook validation and storage
    csv.ts          import/export dialects
    session.ts      JWT cookie
    auth.ts         guards
scripts/            migrate, seed-admin, reindex, add-book, backup.sh
tests/              Vitest — unit and integration against a temp database
```

## Two rules worth knowing before changing anything

**Reads are synchronous.** `better-sqlite3` blocks. That is fine — queries against a few
thousand rows take microseconds — but it means a slow query blocks the event loop, so
never put a network call inside one.

**Network work happens outside transactions.** `addBookByIsbn` fetches the metadata and
downloads the cover *first*, then opens the transaction. A `fetch` inside
`sqlite.transaction()` would hold the write lock for the duration of a third-party API
call.
