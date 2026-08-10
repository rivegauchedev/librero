# 08 — Roadmap

## In v1

Everything the brief asked for:

- Barcode scanning and ISBN/title lookup, with a four-state ownership verdict
- Work → Edition → Copy, with copy quantities for duplicate printings
- Physical and digital copies, with real EPUB/PDF upload and authenticated download
- Open Library metadata with a Google Books fallback, cached, covers stored locally
- Shelf locations, reading status, ratings and notes
- Wishlist
- CSV import (Librero's own format and Goodreads') and lossless export
- Username/password accounts with admin and user roles
- Self-hosted Docker deployment with HTTPS and a tested backup script

## Known limitations

Things that are true today and worth knowing before you hit them.

**Open Library's search ranking is poor for bare titles.** Searching `dune` returns the
sequels above the original. Mitigated by putting your own shelf's matches first, but the
provider list below them stays in Open Library's order.

**`first_publish_year` is often the printing year.** Open Library's *work* records
frequently lack `first_publish_date`, so the code falls back to the edition's publish
date. Their search endpoint has the right value; using it would cost a second request per
lookup.

**One SQLite connection per process, deliberately.** `src/db/index.ts` caches the
handle on `globalThis` unconditionally. Next compiles route handlers, Server Actions and
pages into separate module graphs; without the cache, production opens several handles on
the same file and a read can miss a write that was just committed on another. The E2E
suite is what caught this, and it is the reason that cache is not guarded by `NODE_ENV`.

**No login rate limiting.** See [05-auth-and-roles](05-auth-and-roles.md). The intended
deployment is behind Tailscale or a LAN.

**Sessions cannot be revoked individually.** There is no session table; rotating
`SESSION_SECRET` signs everyone out at once.

**Uploaded ebooks are downloaded, not read.** No in-browser reader.

**One series per book in the UI.** The schema supports several; the edit form exposes one.

**CSV import matches on ISBN, then title+author.** Two genuinely different books with the
same title and author surname would merge. Rare, and the dry-run preview shows it before
anything is written.

## Next, roughly in order of value

**Bulk actions on the library table.** Row selection is already wired into the data table;
what is missing is "move these twelve to shelf C2" and "delete these".

**Statistics.** Books per year, pages read, most-owned publisher, spend by year — the data
is all there (`purchase_price_cents`, `date_finished`, `page_count`) and nothing reads it
yet.

**A better duplicate report.** A page listing works that probably should be merged: same
title, similar author, no shared work id.

**Offline scan queue.** A bookshop basement has no signal. The shelf lookup already works
without the network; queueing the *provider* lookup for later would make the scanner fully
offline-capable. This is the change that would most improve the core use case.

**PWA install.** Manifest and service worker, so the check screen is one tap from the home
screen. Pairs naturally with the offline queue.

**Author and series pages.** `/authors/[id]`, `/series/[id]` — the joins exist, the routes
do not.

**Loan tracking.** "Lent to Ana, March" is a common bookshelf need and a small addition: a
nullable `lent_to` and `lent_at` on `copies`.

## Deliberately not planned

- **Per-user private libraries.** Would double the schema and every query's auth surface
  to solve a problem a shared household does not have. If it is ever needed, it is a
  `owner_id` on `copies` and a filter in `queries/`, not a rewrite.
- **A public catalogue view.** Every route requires a session, on purpose.
- **Lending to strangers, reservations, fines.** This is a bookshelf, not a library.
- **Postgres.** SQLite is the right size for this. The data layer is isolated enough in
  `src/db/` that a move would be contained, but nothing about a personal bookshelf calls
  for a database server.
- **Scraping retailers for metadata.** Open Library and Google Books are offered as APIs
  and are enough.
