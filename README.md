# Librero

*Librero* is Spanish for bookshelf. It is a small self-hosted catalogue of the books you
own, built to answer one question well:

> You are standing in a bookshop holding a book. Do you already own it?

Scan the barcode and Librero tells you — and, because it models editions properly, it
tells you *which* one you own, so the hardcover in your hand is a real decision rather
than an accidental second copy.

## What it does

- **Bookstore check** — scan an ISBN barcode with your phone camera, or type a title.
  Answers in one screen: already owned / owned in another edition / on your wishlist /
  not owned.
- **Editions and copies** — the same book in paperback and hardcover are two editions;
  two identical paperbacks are one edition with a quantity of two.
- **Physical and digital** — record where a physical copy sits on your shelves, or note
  the format and service (Kindle, Kobo, Audible…) a digital copy lives on.
- **Metadata for free** — Open Library first, Google Books to fill the gaps. No API key
  needed.
- **Reading status, ratings and notes**, per book.
- **Wishlist** — books you want, so a bookshop lookup says "you wanted this".
- **CSV import/export**, including Goodreads exports.
- **Accounts** — one shared library; administrators additionally manage users.

Comfortably handles a few thousand books. Above that, SQLite is still fine but you are
probably running a library, not a bookshelf.

## Quick start (Docker)

```bash
cp .env.example .env
# Fill in SESSION_SECRET and ADMIN_PASSWORD:
openssl rand -base64 48        # -> SESSION_SECRET

docker compose up -d
```

Open `https://localhost` (or your `LIBRERO_HOSTNAME`), sign in with `ADMIN_USERNAME` and
`ADMIN_PASSWORD`, and you will be asked to choose a real password immediately.

**HTTPS is not optional if you want the scanner.** Browsers only grant camera access on a
secure origin, so a phone talking to `http://…` cannot scan. The bundled Caddy service
handles this; [docs/06-deployment.md](docs/06-deployment.md) covers the alternatives.

## Quick start (local development)

```bash
npm install
cp .env.example .env.local     # set SESSION_SECRET and ADMIN_PASSWORD
npm run db:migrate
npm run seed:admin
npm run dev                    # http://localhost:3000
```

`localhost` counts as a secure origin, so the scanner works there too — on the machine's
own webcam.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | Builds, then runs the Playwright suite against the standalone server |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio against the local database |
| `npm run seed:admin` | Create the first administrator (no-op if any user exists) |
| `npm run reindex` | Rebuild the full-text search index |
| `npm run cache:clear` | Empty the Open Library / Google Books response cache |
| `npm run book:add -- <isbn>` | Add a book from the command line |
| `./scripts/backup.sh [dir]` | Snapshot the database and cached covers to a tarball |

## Everything lives in one directory

`LIBRERO_DATA_DIR` (default `./data`, `/data` in Docker) holds `librero.db` and
`uploads/`. Back that directory up and you have backed up the whole application; there is
no other state.

## Documentation

| | |
| --- | --- |
| [01 Overview](docs/01-overview.md) | The problem, the goals, the non-goals |
| [02 Architecture](docs/02-architecture.md) | Stack, request flow, directory map |
| [03 Data model](docs/03-data-model.md) | Work → Edition → Copy, and why |
| [04 Metadata providers](docs/04-metadata-providers.md) | Open Library, Google Books, merging, caching |
| [05 Auth and roles](docs/05-auth-and-roles.md) | Sessions, guards, administrators |
| [06 Deployment](docs/06-deployment.md) | Docker, HTTPS, backup and restore |
| [07 Actions and APIs](docs/07-actions-and-apis.md) | Every Server Action and route |
| [08 Roadmap](docs/08-roadmap.md) | What is deliberately not built yet |

## License

[GNU Affero General Public License v3.0](LICENSE) — copyright 2026 Gerson Umanzor.

Run it, change it, share it, host it, sell it. The one condition is reciprocity: if you
distribute Librero or run a modified version as a network service, the people using it
must be able to get the complete corresponding source, under this same licence.

Contributions are welcome on those terms. Third-party components keep their own licences;
see [NOTICE](NOTICE) and [Credits](#credits).

## Credits

The UI is built on the MIT-licensed
[ShadcnStore dashboard template](https://github.com/shadcnstore/shadcn-dashboard-landing-template)
and [shadcn/ui](https://github.com/shadcn-ui/ui).
The Work → Edition → Copy model is borrowed from
[Library of Alexandria](https://github.com/Statisticonomicon/library-of-alexandria).
Book metadata comes from [Open Library](https://openlibrary.org) and
[Google Books](https://books.google.com).
