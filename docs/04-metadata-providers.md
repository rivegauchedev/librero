# 04 — Metadata providers

Two free sources, one interface. Nothing downstream of `src/lib/providers/index.ts` knows
or cares where a book's details came from.

```ts
interface MetadataProvider {
  lookupByIsbn(isbn13: string, isbn10: string | null): Promise<NormalizedBook | null>
  search(query: string, limit: number): Promise<SearchResult[]>
}
```

## Open Library first

Open Library is the primary source for one reason: it is the only free, key-less API with
a genuine **work versus edition** distinction, which is exactly the model our catalogue is
built on. Google Books has volumes and nothing above them.

### Why the ISBN lookup is not three chained requests

The obvious implementation is `/isbn/` → `/works/` → `/authors/`. It is also
wrong, and it cost us a real bug: *Circe* (Bloomsbury 2018, 9781408890080)
reported as "no book found" despite being catalogued perfectly.

Measured against the live API for that one book:

| Call | Time |
| --- | --- |
| `GET /isbn/9781408890080.json` | 5.2 s |
| `GET /works/OL18012166W.json` | 4.2 s |
| `GET /authors/OL1926056A.json` | 10.1 s |
| `GET /search.json?isbn=9781408890080` | 3.4 s |

Chained, that is ~19 s against what was a 6 s per-request timeout. The
`/authors/` call blew it, the retry blew it again, the whole lookup threw, and
the caller saw nothing. Worse, that edition record carries **no authors and no
page count** at all — both live only in the search document.

So the lookup now works like this:

1. `search.json?isbn=` and `/isbn/` run **in parallel**. The search document
   alone answers title, authors, year, page count and cover; the edition record
   adds publisher, binding, language and series.
2. `/works/` follows, for the description, on a 5-second budget.
3. `/authors/` is called only when the *edition* names author keys — search
   documents list every name attached to the work, transliterations included
   (Dune arrives as `["Frank Herbert", "Френк Герберт"]`), so the edition's own
   records win when they exist.

Steps 2 and 3 use `fetchJsonOptional`: they enrich the answer, and are never
allowed to destroy it. Either source alone is enough to return a book.

Three quirks the code handles, all verified against live responses:

- **`publish_date` is free text** — `"August 2, 2005"`. `yearFrom()` pulls a four-digit
  year out with a regex rather than trusting `Date.parse`.
- **`description` is sometimes a string, sometimes `{ value }`**, and often ends with a
  `----------` source credit. `plainDescription()` flattens and truncates it.
- **`series` is one packed string** — `"Dune (1); Dune Chronicles, Book 1"`.
  `parseSeries()` takes the part before the first `;` and pulls the number out of the
  parentheses.

`physical_format` is free text too (`"Mass Market Paperback"`, `"Hardback"`, …) and is
mapped onto our fixed format set, falling back to `null` rather than guessing.

## Google Books as a fallback

Consulted for an ISBN when Open Library came back with nothing, or with a record
missing a description, a page count or an author; and for a search when Open
Library returned fewer than five results. It is better at recent and non-English printings,
and its descriptions are fuller.

Two things it cannot do, so the merge never takes them from it:

- **No binding information.** A Google volume cannot distinguish hardcover from paperback,
  so `format` is always `null`.
- **No series.**

Its thumbnails come back as `http:` with `zoom=5`; both are rewritten.

**Set `GOOGLE_BOOKS_API_KEY`.** It is nominally optional, but anonymous requests
are answered with HTTP 429 most of the time — during development every single
live call to Google Books was rate-limited. Without a key the fallback is
effectively dead, which is also why its test fixture is hand-authored to the
documented shape rather than captured live. A 429 is never retried; retrying a
rate limit immediately only burns what is left of the quota.

## The merge

`mergeBooks(openLibraryRecord, googleRecord)` is field-by-field, not
whole-record-preferred:

| Field group | Winner | Reason |
| --- | --- | --- |
| title, authors, series, work/edition ids | Open Library | These are the identity fields our catalogue is keyed on. Google's titles carry marketing cruft — *"Dune (Movie Tie-In)"* |
| description, page count, cover | whichever has one, Open Library first | Pure gap-filling |
| format | Open Library only | Google has no opinion to take |

`isUsable()` rejects a record with no real title, so a thin Open Library stub loses to a
complete Google one rather than winning on precedence alone.

## Search results are re-ranked locally

Open Library finds the right books and orders them badly. Measured:

| Query | Open Library's own top results |
| --- | --- |
| `circe` | a study guide, then *The Night Circus*, then the novel |
| `dune` | four sequels before the original |
| `circe madeline miller` | *"Summary of Circe by Madeline Miller"* in the top three |

Its `sort=readinglog` parameter fixes the first hit and ruins the rest —
searching `dune` then returns *Jane Eyre* and *Ulysses*, which are merely
popular. So neither ordering is usable on its own.

`ranking.ts` asks for a wide candidate set (3× the requested limit) with the
popularity fields attached, and scores each result:

- **Relevance** — exact normalized title match, prefix, substring, per-word
  overlap, and author-surname match.
- **Popularity** — `readinglog_count`, `ratings_count` and `edition_count`, each
  log-compressed so a bestseller cannot bury an exact title match.
- **Penalties** — summaries, study guides and workbooks are demoted rather than
  dropped (someone may own a SparkNotes); so are records with no author and
  sub-40-page fragments.

Two passes then clean up the list:

- **A relevance floor.** A result matching nothing in the query is dropped
  entirely — a study guide for an unrelated book has no business appearing just
  because it is popular. If *nothing* matches (a subject-style query like
  "science fiction"), everything is kept and popularity orders the list, because
  returning nothing would be worse.
- **Deduplication.** Open Library holds several work records for the same book:
  "the song of achilles" returns it three times, "meditations" five. They are
  collapsed on normalized title plus author surname, keeping the best-scoring
  record and preferring one that has an ISBN — a result with no ISBN cannot be
  added in one tap. This is what makes the list look full rather than repetitive.

Google Books is appended only when Open Library came back with fewer than five
results, and never interleaved.

On top of all that, `/api/lookup` runs a local FTS query first and returns those
hits in a separate `shelf` array rendered above the provider results. Your own
shelf is the authoritative answer to "do I own this", it ranks correctly, and it
is the only part that still works when the network is down.

## Caching

Every merged response is cached in the `metadata_cache` table, keyed by
`provider + key`, for 30 days.

- Re-scanning a book you looked up last week costs one SQLite read.
- It keeps request volume low enough to stay well inside Open Library's limits.
- **Empty answers are never cached.** The providers swallow their own failures
  and return null, so at the cache layer a timeout is indistinguishable from
  "no such book" — and caching that for 30 days turns one slow afternoon into a
  month of a real book reporting as unknown. This was a live bug.

`npm run cache:clear` empties it. The catalogue is untouched; the cache refills
on the next search.

Requests carry `User-Agent: Librero/0.1 (<LIBRERO_CONTACT_EMAIL>)`, as Open Library's API
policy asks, with a 15-second timeout (Open Library genuinely needs it) and a single retry.

## Covers

Downloaded once, at add time, to `uploads/covers/{sha1-of-bytes}.{ext}`, and served back
through the authenticated `/api/covers/…` route.

Never hotlinked, for three reasons: every page render would otherwise depend on Open
Library being fast, the library would break when it is down, and hotlinking would leak
what you are reading to a third party on every page view. Content-addressed naming means
two editions sharing a cover store one file, and the immutable filename lets the route set
a one-year cache header.

A failed cover download returns `null` and is ignored — a missing thumbnail must never
block adding a book.

## Testing them

`tests/providers.test.ts` stubs `fetch` and routes each URL to a recorded fixture in
`tests/fixtures/`. No test touches the network: Open Library is a wiki, and a test that
fails because a volunteer edited a record is worse than no test at all.

To refresh a fixture:

```bash
curl -sL -H 'User-Agent: Librero/0.1 (you@example.com)' \
  https://openlibrary.org/isbn/9780441013593.json > tests/fixtures/ol-edition-dune.json
```
