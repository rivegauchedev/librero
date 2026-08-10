# 03 — Data model

## The three levels

```
Work        the book as an idea       "Dune", by Frank Herbert
 └─ Edition  a specific publication    Ace, 2005, paperback, ISBN 9780441013593, 544pp
     └─ Copy   a thing you own          on shelf B3, ×2   |   an EPUB on disk
```

This split is not bookkeeping pedantry — it is what makes the bookshop verdict useful.
Collapse it and you get one of two broken answers:

- **Work only:** "you own Dune." Useless — you are holding a hardcover and you own the
  paperback, and the app cannot tell you that.
- **Edition only:** "you don't own this." Technically true and actively misleading; you
  own the same book in a different printing and probably don't want a second.

Keeping all three levels is what lets `OWNED_SAME_EDITION` and `OWNED_OTHER_EDITION` be
different answers.

```mermaid
erDiagram
    works ||--o{ editions : "has printings"
    editions ||--o{ copies : "you own"
    works ||--o{ work_authors : ""
    authors ||--o{ work_authors : ""
    works ||--o{ work_series : ""
    series ||--o{ work_series : ""
    works ||--o{ work_tags : ""
    tags ||--o{ work_tags : ""
    works ||--|| works_fts : "indexed as"

    works {
        int id PK
        string title
        string sort_title
        string match_key "normalized, for fuzzy matching"
        string open_library_work_id UK
        string reading_status "unread|reading|read"
        int rating "1-5, nullable"
        bool is_wishlist "wanted, zero copies"
    }
    editions {
        int id PK
        int work_id FK
        string isbn13 UK
        string isbn10
        string format "hardcover|paperback|mass_market|ebook|audiobook|other"
        string edition_note "Folio Society illustrated, signed..."
        string publisher
        int publish_year
        int page_count
        string cover_path "cached locally, never hotlinked"
    }
    copies {
        int id PK
        int edition_id FK
        string medium "physical|digital"
        int quantity "two of the SAME edition"
        string location "Office / shelf B3"
        string file_path "digital only, under uploads/"
        string external_service "kindle|kobo|audible"
    }
    users {
        int id PK
        string username UK
        string password_hash "argon2id"
        string role "admin|user"
        bool must_change_password
    }
```

## Where each thing lives, and why

**Reading status, rating and notes are on the `work`.** You read *Dune*; you do not read
the 2005 Ace printing. Recording it per edition would mean re-entering it every time you
bought another copy.

**`quantity` is on the `copy`.** This is the "I own two of the same edition" case the
brief called out: two identical paperbacks are one copy row with `quantity = 2`, not two
rows. Two *different* printings are two editions.

**`location` is on the copy, not the edition.** Your hardcover is in the office and your
paperback is by the bed.

**`is_wishlist` is on the work, and is derived in practice.** A wishlist entry is a work
flagged `is_wishlist` with zero copies. Adding a copy clears the flag automatically
(`clearWishlistFlagForEdition` in `src/db/mutations/catalog.ts`) — you cannot own a book
and want it at the same time.

**Prices are integer cents.** Floats and money do not mix.

**Covers are on the edition**, because a hardcover and a paperback do not share
artwork. `cover_path` is a file in the local cover store; `cover_source_url`
records where it came from, so the edit form can show what was pasted and skip
re-downloading an unchanged address. Both are null for an edition with no cover.

## Matching keys

Two derived columns exist purely so ownership matching can be fast and forgiving:

- `works.match_key` — lowercased, diacritics stripped, leading article dropped, subtitle
  after `:` discarded, punctuation collapsed. `"Dune: Special Edition"`, `"DUNE"` and
  `"  Dune "` all reduce to `dune`.
- `authors.match_key` — the surname alone, folded the same way. `"Ursula K. Le Guin"` and
  `"Le Guin, Ursula K."` both reach a usable key.

A fuzzy match requires **both** to agree. Title alone would happily merge every book
called *Ulysses*.

## Full-text search

`works_fts` is an FTS5 virtual table over title, subtitle, authors, ISBNs and series, with
`unicode61 remove_diacritics 2` so "Garcia" finds "García".

Its contents are an aggregate across five tables, so it is **not** maintained by triggers.
`reindexWork(workId)` rebuilds one work's row and is called inside the same transaction as
any mutation that could change it. The single exception is a trigger,
`works_after_delete_fts`, which catches rows removed by `ON DELETE CASCADE` — those never
pass through application code.

If the index is ever suspected to be stale: `npm run reindex`.

## Deletion

`ON DELETE CASCADE` runs from works down through editions to copies. SQL cannot unlink
files, so the delete actions in `src/actions/books.ts` collect the affected copy ids
*before* deleting and remove their upload directories afterwards.

## Changing the schema

```bash
# 1. edit src/db/schema.ts
npm run db:generate     # writes a new file to src/db/migrations/
npm run db:migrate      # applies it
```

For anything Drizzle cannot express — FTS tables, triggers, backfills — generate an empty
migration and write the SQL by hand:

```bash
npx drizzle-kit generate --custom --name=what_it_does
```

Statements in a hand-written migration are separated by `--> statement-breakpoint`.
