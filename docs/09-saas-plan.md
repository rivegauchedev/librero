# 09 — SaaS plan

## What this is

A phased plan for offering Librero as a hosted service — `my.librero.app` for
individuals, `{biz}.librero.app` for named organizations — without giving up the
self-hosted Docker deployment that the rest of these docs describe. Self-hosting stays a
first-class mode; the SaaS is a second deployment target of the same codebase.

This document is the sequencing and the decisions. Each phase ends in something
shippable, and no phase requires throwing away work from an earlier one.

## Tiers

| Tier | Books | Price | Gate |
| --- | --- | --- | --- |
| Free | under 50 | $0 | default on signup |
| Personal | 50 – 500 | paid | Stripe subscription |
| Library | 500 – 2,000 | paid, higher | Stripe subscription |
| Enterprise | over 2,000 | contact sales | manual provisioning |

**What counts as a "book": a distinct work with at least one owned copy.** Not copies —
three printings of *Dune* are one book against the cap, which matches how a person counts
their shelf and avoids punishing exactly the duplicate-tracking the app is for. Wishlist
entries are free at every tier. Enforcement happens at write time in the Server Actions
and in the CSV importer — the importer checks the *resulting* count in its dry run, not
the current one, so a 600-row import into a Free library is refused with a number, not
discovered 50 rows in.

There is no storage axis, because **the SaaS does not host ebook files**. Digital copies
are records: format, the existing `external_service` field ("kindle", "kobo"…), and a new
optional `external_url` for people who keep the file in their own Drive/Dropbox/NAS.
Self-hosted Librero keeps real uploads; the hosted service deliberately doesn't offer
them. That one decision removes the largest cost (object storage and egress for files up
to 100 MB), the hardest technical constraint (serverless body limits), and the heaviest
legal exposure (hosting copyrighted files on users' behalf). The only files the platform
stores are cover images, which are small enough to be a rounding error at every tier.

## Target architecture

Two planes, one codebase.

**Control plane** — one database, owned by the platform:

- Better Auth's tables: users, revocable sessions, organizations, members, invitations
- The tenant registry: `{slug} → Turso database URL, auth token, plan, status`
- Billing state mirrored from Stripe webhooks

**Data plane** — per tenant:

- One Turso (libSQL) database with the *existing, unchanged* Librero schema
- One prefix in an object-storage bucket for covers only (`{tenantId}/covers/…`)

This is the database-per-tenant model, and it is deliberate. The alternative — a
`tenant_id` column on every table and a filter in every query — touches all of `src/db/`
and creates the class of bug where a missed filter shows tenant B tenant A's shelves.
Per-tenant databases keep the app's founding assumption ("one database is one library"),
make the tier check a `COUNT(*)` in the tenant's own database, make export honest
("here is your SQLite file"), and are the workload Turso's platform is priced and
API-shaped for. It is also why [08-roadmap](08-roadmap.md)'s refusal of per-user private
libraries survives: the schema still never learns about tenants.

Request flow: wildcard DNS points `*.librero.app` at the app. Middleware reads the
`Host` header, resolves the slug against the tenant registry (cached), and hands the
request a database client for that tenant's URL. `auth.librero.app` is Better Auth; its
session cookie is set on `.librero.app`, so one login works on `my.` and every `{biz}.`
subdomain.

**Hosting:** the decision is deferred to Phase 0, but the constraint is known — the
platform must route a wildcard subdomain to one Next.js app. Vercel supports this
first-class; Netlify's wildcard support is plan-restricted and needs verifying before
committing; and the existing Docker/Caddy stack on Fly.io or a VPS already does
on-demand TLS and remains the fallback that changes the least.

## What each mode looks like when it's done

| Concern | Self-hosted (unchanged promise) | SaaS |
| --- | --- | --- |
| Database | Local SQLite file via `file:` URL | Turso database per tenant |
| Ebooks | Uploaded to `data/uploads/`, downloadable | Recorded only — service/URL, no file hosting |
| Covers | Local `data/uploads/covers/` | Object storage, per-tenant prefix |
| Auth | Local accounts, as today | Better Auth at `auth.librero.app` |
| Limits | None | Tier cap on works |
| Backup | Tar one directory | Platform's job (fleet snapshots + export) |

The same `@libsql/client` speaks both `file:` and `libsql://` URLs, which is what makes
one codebase serve both columns.

---

## Phase 1 — Async data layer (libSQL)

The foundation everything else stands on, and identical under every hosting choice.

- Replace `better-sqlite3` with `@libsql/client` and `drizzle-orm/better-sqlite3` with
  `drizzle-orm/libsql` in `src/db/index.ts`, `scripts/migrate.mjs`, and the maintenance
  scripts. Local dev and self-host keep working through a `file:` URL — no Turso account
  needed to run the app.
- Convert the synchronous call sites to async. The raw `sqlite.prepare(…)` usage lives in
  `src/db/mutations/*`, `src/db/queries/works.ts`, `src/db/fts.ts`,
  `src/lib/providers/cache.ts`, `src/actions/books.ts`, and the health route. The hard
  part is the transactions: `sqlite.transaction(() => …)` blocks (catalogue writes with
  their FTS updates, CSV import, reindex) become libSQL interactive transactions, and
  [02-architecture](02-architecture.md)'s "synchronous driver" rationale gets rewritten
  honestly.
- The `globalThis` single-connection cache becomes a small connection map (keyed by
  database URL), which is exactly the seam Phase 3 needs.
- Vitest suite green against a `file:` database; E2E suite green — it is the test that
  caught the multi-handle read-your-writes bug last time, so it is the arbiter here too.

**Exit criteria:** app runs unchanged on a local file *and* against a real Turso database
by flipping one environment variable. No user-visible change.

## Phase 2 — Cover storage and the no-hosting rule

Much smaller than it would be if the service hosted ebooks — that is the point.

- A cover-storage interface with two drivers: local filesystem (self-host, the
  content-addressed store in `src/lib/covers.ts` as it exists today) and S3-compatible
  object storage (SaaS — Cloudflare R2 proposed). Covers are fetched server-side from
  the metadata providers and are tens of kilobytes, so no body-limit or direct-upload
  machinery is needed. `src/app/api/covers/[...path]/route.ts` keeps its URL and auth
  check, redirecting to a short-lived signed URL when the S3 driver is active.
- A capability flag (`ebookUploads`), on for self-host, off in SaaS mode. With it off,
  the upload form and `src/app/api/files/[copyId]/route.ts` are simply absent, and
  `src/lib/uploads.ts` is never reached.
- Schema addition, useful in both modes: `external_url` on `copies`, next to the
  existing `external_service`. A digital copy in the SaaS is a record — format,
  service, optional link to wherever the user keeps the file — and the copy form
  renders a URL field where self-host renders an upload control. The URL is stored and
  linked out, never fetched or proxied.
- CSV import/export carries the new column, so a self-hosted library with real files
  still round-trips into the SaaS as records (file paths export as names, not
  contents).

**Exit criteria:** covers work in both drivers; SaaS mode builds with no upload surface
at all; self-hosted behavior byte-identical to today.

## Phase 3 — Control plane and tenancy

The SaaS core.

- Control-plane schema and migrations (its own database, its own Drizzle config —
  Better Auth's tables land here in Phase 4).
- Tenant-resolution middleware: `Host` → slug → registry row → per-request tenant
  context carrying the database client and storage prefix. Unknown subdomain → a real
  404 page, suspended tenant → a suspended page.
- Provisioning: creating a tenant calls the Turso platform API to create the database,
  runs the Librero migrations against it, and writes the registry row. Deprovisioning
  archives rather than deletes.
- Fleet migrations: `db:migrate` grows a mode that iterates the registry and applies
  pending migrations to every tenant database, and deploys run it.
- Wildcard DNS and TLS on the platform chosen in Phase 0.

**Exit criteria:** two test tenants on two subdomains, fully isolated, provisioned by
script; a schema migration applied across the fleet in one command.

## Phase 4 — Better Auth at `auth.librero.app`

- Stand up Better Auth against the control-plane database: email/password first,
  organizations plugin for the `{biz}` tenants, cookie domain `.librero.app`.
- In SaaS mode the app verifies Better Auth sessions; membership in the tenant's
  organization is the authorization check, and Better Auth roles map onto the existing
  `admin`/`user` roles from [05-auth-and-roles](05-auth-and-roles.md).
- Self-host keeps the hand-rolled ~120-line auth. It is small, fully owned, and its
  documented limitations (no per-session revocation, no rate limiting) are acceptable on
  a LAN — and none of those limitations ship in the SaaS, where Better Auth provides
  session revocation and rate limiting out of the box.
- Login rate limiting and email verification are launch blockers for anything on the
  public internet; they arrive with this phase, not Phase 6.

**Exit criteria:** sign up once, use the same session on `my.` and a `{biz}.` subdomain
you're a member of; sign-out and session revocation actually revoke.

## Phase 5 — Billing and entitlements

- Stripe Checkout for upgrades, the customer portal for card and cancellation, webhooks
  updating the control plane. The registry row's plan is the single source of truth the
  app reads; Stripe is the source of truth the webhooks copy from.
- Entitlement checks in the add-book actions and the CSV importer, per the tier table
  above. Over-cap after a downgrade is read-only-for-adds: nothing is ever deleted, adds
  are refused with the count and an upgrade link, export always works.
- Enterprise: a contact form and a `plan = enterprise` flag that lifts the caps —
  provisioning stays manual on purpose until there is a second enterprise customer.

**Exit criteria:** a Free tenant hits 50 works, upgrades with a test card, the cap lifts
without a deploy; a webhook replay is idempotent.

## Phase 6 — Onboarding, operations, launch

- Signup flow: account → tenant slug ("claim your subdomain") → provisioned library →
  first scan. The slug namespace needs a reserved-words list (`www`, `auth`, `my`,
  `api`, `admin`, real trademarks) and manual review for claiming a name like `nypl`.
- Fleet operations: scheduled export of every tenant database and bucket prefix to cold
  storage, uptime monitoring, error tracking, an internal admin page over the registry.
- Abuse controls: signup rate limiting and a takedown contact. Because the service
  hosts no ebook files — only metadata and outbound links users typed in — the abuse
  surface is a fraction of what a file-hosting service carries; a policy for removing
  infringing *links* on notice is still worth having, but it is a paragraph in the
  terms, not a compliance program.
- Terms of service and privacy policy; a `librero.app` landing page with the pricing
  table.
- Licensing note: Librero is AGPL-3.0 with a single copyright holder, so offering it as
  a service is unambiguous today. If outside contributions are ever accepted, a CLA is
  what preserves the right to run the SaaS relicensed or closed-features; decide before
  merging the first external PR, not after.

**Exit criteria:** a stranger can sign up, add 49 books free, pay, and leave with their
data — with no human in the loop.

---

## Phase 0 — Decisions to make before Phase 1 lands

Small, but they gate later phases:

1. **Hosting platform** (gates 3): Vercel, Netlify-with-verified-wildcards, or the
   existing Docker image on Fly/VPS.
2. **Pricing numbers** for Personal and Library (gates 5; the *mechanics* don't need
   them, the landing page does).
3. **Confirm the billable unit** — this plan says works, not copies (gates 5).
4. **Domain and orgs**: `librero.app` DNS, Turso organization, R2 bucket (covers
   only), Stripe account (gates 3, 2, 5 respectively).

## Risks worth naming

- **The async conversion is the riskiest code change.** The FTS-in-the-same-transaction
  guarantee and the read-your-writes behavior are both load-bearing and both documented
  as hard-won. The E2E suite runs on every phase-1 commit for exactly this reason.
- **Per-tenant connection overhead.** Serverless plus a connection per tenant per
  instance is fine at 2 k-book scale, but the connection map from Phase 1 should evict,
  not grow forever.
- **Wildcard support on Netlify** may not materialize on an affordable plan; the
  fallback (Docker on Fly/VPS) is already built, so this risk is bounded. Note that
  dropping hosted ebooks also dropped the 100 MB-body-through-a-function problem, so
  serverless platforms are no longer handicapped on that axis.
- **"Just let us upload" pressure.** Users will ask for hosted ebooks. The
  `ebookUploads` capability flag keeps the door open deliberately — if it is ever
  worth the storage cost and the DMCA program, it becomes a paid add-on behind that
  flag, not a rewrite. Until then the answer is the `external_url` field.
- **Scope creep from enterprise conversations.** SSO/SAML is deliberately *not* in this
  plan; Better Auth has an SSO plugin when a real contract asks for it, and not before.
