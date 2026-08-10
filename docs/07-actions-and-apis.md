# 07 — Server Actions and API routes

## The shape every action shares

```ts
type ActionState = { error?: string; success?: string; workId?: number }

export async function someAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState>
```

Called from `useActionState`, surfaced by `useActionFeedback` (`src/components/action-form.tsx`)
as a toast. Every one of them:

1. calls `assertUser()` or `assertAdmin()` first;
2. parses `FormData` with Zod;
3. mutates inside a transaction;
4. calls `revalidatePath()`;
5. returns a message — never throws at the client.

Note the `optionalText` / `optionalInt` / `optionalList` helpers in `src/actions/books.ts`:
`FormData.get()` returns `null` for a field the form did not render, and
`Object.fromEntries` omits it entirely, so every optional field must accept `string`,
`null` **and** `undefined`. A plain `z.string().optional()` rejects `null` and produces
the unhelpful "expected string, received null".

## `src/actions/auth.ts`

| Action | Guard | Notes |
| --- | --- | --- |
| `login` | — | Identical error for unknown user and bad password; hashes anyway on the not-found path so timing does not leak. Redirect target must start with a single `/` |
| `logout` | — | Clears the cookie, redirects to `/login` |
| `changePassword` | user | Verifies the current password, then re-issues the cookie so the `mustChangePassword` gate lifts at once |

## `src/actions/books.ts`

| Action | Guard | Notes |
| --- | --- | --- |
| `addBookByIsbn` | user | The one-tap path off the check screen. Fetches metadata and caches the cover **before** opening the transaction |
| `addBookManually` | user | For books with no ISBN, or that no provider knows |
| `saveWork` | user | Title, authors, series, tags, description. Re-derives the match keys and reindexes |
| `saveReadingProgress` | user | Status, rating, notes. Stamps `date_finished` the first time status becomes `read` |
| `toggleWishlist` | user | Refuses to wishlist a book that still has copies — you cannot own and want the same book |
| `removeWork` | user | Cascades to editions and copies; unlinks their upload directories |
| `addEdition` / `saveEdition` / `removeEdition` | user | |
| `addCopy` / `saveCopy` / `removeCopy` | user | `medium` is fixed once a copy exists: changing it would orphan an uploaded file |

## `src/actions/users.ts` — administrators only

`createUser`, `resetUserPassword`, `changeUserRole`, `deleteUser`. Admin-set passwords
always carry `mustChangePassword`. The last-administrator and self-modification
invariants live here; see [05-auth-and-roles](05-auth-and-roles.md).

## `src/actions/uploads.ts`

`uploadEbook` validates extension **and** magic bytes, enforces `MAX_UPLOAD_MB`, and
writes to `uploads/books/{copyId}/{sanitized-name}` — a path built entirely from the copy
id and a sanitized basename, never from client input. Replacing a file clears the old
directory first. `deleteEbook` is the inverse.

`next.config.ts` raises `serverActions.bodySizeLimit` to `MAX_UPLOAD_MB + 2`; without
that, Next rejects the request before the action sees it.

## `src/actions/import.ts`

`previewCsvImport` is a dry run: it parses, classifies every row (new / new edition /
already recorded / unusable) and writes nothing. `confirmCsvImport` applies the whole file
in one transaction, so a failure halfway leaves no partial library.

## API routes

Routes exist only where the response cannot be HTML. All are excluded from the proxy
matcher and check `getSession()` themselves.

| Route | Auth | Returns |
| --- | --- | --- |
| `GET /api/lookup?q=` | session | The check screen's data: local `shelf` matches plus provider `candidates`, each with its ownership verdict already resolved. Sets `providerUnavailable` rather than failing when the network is down |
| `GET /api/library-search?q=` | session | Up to 8 local hits for the ⌘K palette |
| `GET /api/covers/[...path]` | session | A cached cover. Resolves the path and rejects anything outside the covers directory. Immutable cache header — filenames are content hashes |
| `GET /api/files/[copyId]` | session | An uploaded ebook, streamed, `Content-Disposition: attachment`. Uploads live outside the public tree so this is the only way to reach one |
| `GET /api/export` | session | The whole catalogue as CSV, one row per copy |
| `GET /api/health` | none | `{"status":"ok"}` for the container healthcheck |

## Reads

Page components query `src/db/queries/` directly — synchronous `better-sqlite3` calls
returning flat typed rows. No fetch, no route, no serialisation.

| Module | Provides |
| --- | --- |
| `queries/works.ts` | `listWorks`, `listWishlist`, `listRecentlyAdded`, `listCurrentlyReading`, `getWorkDetail` |
| `queries/search.ts` | `searchLibrary` — exact ISBN first, then FTS5 |
| `queries/stats.ts` | Dashboard counts, summing copy quantities rather than rows |
| `queries/export.ts` | The flattened CSV projection |
