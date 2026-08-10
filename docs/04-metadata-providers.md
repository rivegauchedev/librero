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

`lookupByIsbn` walks three endpoints:

| Call | Gives us |
| --- | --- |
| `GET /isbn/{isbn13}.json` | The edition: publisher, publish date, pages, language, ISBNs, cover ids, `physical_format`, series, and a link to the work |
| `GET /works/{id}.json` | The work: description, subjects, first publish date |
| `GET /authors/{id}.json` | Author names (the edition only carries keys) |

Search is `GET /search.json?q=…&fields=…`, requesting only the fields we use.

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

Consulted only when Open Library came back with nothing, or with a record missing a
description, a page count or an author. It is better at recent and non-English printings,
and its descriptions are fuller.

Two things it cannot do, so the merge never takes them from it:

- **No binding information.** A Google volume cannot distinguish hardcover from paperback,
  so `format` is always `null`.
- **No series.**

Its thumbnails come back as `http:` with `zoom=5`; both are rewritten.

An API key (`GOOGLE_BOOKS_API_KEY`) is optional and only raises the quota. Anonymous
requests from shared IPs are frequently rate-limited with a 429 — which is exactly why the
test fixture for Google Books is hand-authored to the documented shape rather than
captured live, and why every provider call is wrapped in `.catch(() => null)`.

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

## Search does not merge

`searchBooks()` returns Open Library's results, and falls back to Google Books **only when
Open Library returns zero rows**. Interleaving two different relevance rankings makes the
list worse, not better.

Open Library's ranking is, however, genuinely poor for bare titles — searching `dune`
returns *Children of Dune* and *God Emperor of Dune* above the original. Rather than fight
it, `/api/lookup` runs a local FTS query first and returns those hits in a separate
`shelf` array that the UI renders above the provider results. Your own shelf is the
authoritative answer to "do I own this", it ranks correctly, and it is the only part that
still works when the network is down.

## Caching

Every merged response is cached in the `metadata_cache` table, keyed by
`provider + key`, for 30 days.

- Re-scanning a book you looked up last week costs one SQLite read.
- It keeps request volume low enough to stay well inside Open Library's limits.
- Failures are **not** cached — a network blip must not be remembered as "no such book".

Requests carry `User-Agent: Librero/0.1 (<LIBRERO_CONTACT_EMAIL>)`, as Open Library's API
policy asks, with a 6-second timeout and a single retry.

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
