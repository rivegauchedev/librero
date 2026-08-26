# 01 — Overview

## The problem

You are in a bookshop. You are holding a book you are fairly sure you want. You are less
sure whether the copy on your shelf at home is this book, a different book by the same
author, or this book in a different binding.

Getting it wrong costs money and shelf space. Checking properly means either a very good
memory or a spreadsheet you never actually keep current.

## The answer Librero gives

One screen. Scan the barcode, get one of four verdicts:

| Verdict | What it means | What you do |
| --- | --- | --- |
| **You already own this** | Exact ISBN match, and you own at least one copy | Put it back — and it tells you where your copy is shelved |
| **You own a different edition** | Same book, different printing | A real decision: it lists the editions you have, so you can weigh the hardcover against the paperback you own |
| **On your wishlist** | You recorded wanting this | Buy it |
| **Not on your shelf** | No match | Add it in one tap, or wishlist it |

Everything else in the application exists to keep those verdicts accurate.

## Goals

1. **Answer in seconds, one-handed, on a phone.** The scanner and the verdict are the
   product; the catalogue is the supporting cast.
2. **Model editions honestly.** "Do I own this book?" and "do I own *this* book?" are
   different questions, and the second is the one that matters at the till.
3. **Own your data.** One SQLite file and one uploads directory. CSV export that
   re-imports losslessly. No account with anyone, no cloud service to lose access to.
4. **Run on modest hardware.** A Raspberry Pi, a NAS, a small VPS.
5. **Stay small.** A personal bookshelf, not a library management system.

## Non-goals

- **Lending, reservations, patrons, fines.** This is not an ILS.
- **Hosting ebook or audiobook files.** A digital copy is catalogued (format, which
  service it lives on), never uploaded. The files stay on Kindle, Kobo, Audible or your
  own disk.
- **Social features.** No reviews to publish, no friends, no feed.
- **Massive collections.** SQLite would cope with tens of thousands of rows, but the UI is
  designed for a shelf you could walk past, not a stack you would need a catalogue number
  to navigate.
- **Public access.** Every page and every file requires a session. There is no anonymous
  view of anyone's library.

## Who uses it

One household, sharing one collection.

- **Users** add and edit books, copies and reading state.
- **Administrators** do all of that, and manage accounts.

That is the entire permission model, and it is deliberately the entire permission model:
per-user private shelves would double the schema and the query surface to solve a problem
a shared household does not have. See [08-roadmap](08-roadmap.md) if that changes.

## Scale expectations

| | |
| --- | --- |
| Books | Designed for hundreds to a few thousand |
| Concurrent users | A handful; SQLite serialises writes and that is fine |
| Metadata calls | Cached for 30 days per ISBN, so a re-scan costs nothing |
