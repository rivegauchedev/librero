# 09 — SaaS architecture research

What it would take to sell Librero as a hosted subscription while keeping the
self-hosted version first-class. This is a research and design document, not a
commitment; nothing here is built.

## The goal, stated precisely

- **Hosted**: a customer signs up at `librero.app` (or similar), pays a monthly
  subscription, and gets their own library — no Docker, no VPS, no backups to think
  about.
- **Self-hosted stays first-class**: `docker compose up -d` keeps working exactly as it
  does today, with no license key, no phone-home, no account on our servers, and no
  feature held hostage. The self-hosted product is the marketing for the hosted one, not
  a crippled demo.
- **One codebase.** Two products from two codebases is how both rot. Every divergence
  between hosted and self-hosted must live behind an interface chosen by configuration,
  not behind a fork.

The pricing logic is the classic one: the subscription sells *operations* (hosting,
HTTPS, backups, upgrades, support), not *features*. That is also what makes the
one-codebase rule tenable.

## What the current architecture assumes

Librero was built deliberately single-tenant. These are the assumptions a hosted
offering breaks, each with where it lives:

| Assumption | Where it lives | Why it breaks |
| --- | --- | --- |
| One shared library per instance | every query in `src/db/queries/`, no `tenant_id` anywhere | Hosted customers must never see each other's books |
| One SQLite file, handle cached on `globalThis` | `src/db/index.ts` | The cache is keyed to *a* database, not *a tenant's* database |
| All state in one directory (`LIBRERO_DATA_DIR`) | `src/lib/uploads.ts`, covers, `scripts/backup.sh` | Local disk doesn't survive container reschedules; per-tenant quotas need accounting |
| First user is seeded from env vars | `docker-entrypoint.sh`, `scripts/seed-admin.mjs` | Hosted signup is self-service, not operator-provisioned |
| No email anywhere | by design ([05](05-auth-and-roles.md)) | Signup verification, password reset, billing receipts, dunning all need it |
| Sessions can't be revoked individually | no session table, JWT-only | A hosted product needs "sign out everywhere" and support-driven revocation |
| No rate limiting | documented in [05](05-auth-and-roles.md); mitigation is "don't expose to the internet" | The hosted product *is* exposed to the internet |
| Admin role == instance operator | `requireAdmin()` everywhere | Hosted needs two distinct notions: the *tenant's* admin (manages their household's users) and the *platform* operator (manages tenants) |
| Metadata cache is per-instance | `metadata_cache` table | Fine, but hosted can do much better with a shared cache (see below) |
| No billing concept at all | — | Subscriptions, trials, grace periods, entitlements |

Notably *absent* from this list: the data model. Work → Edition → Copy, FTS5, the
provider merge logic, uploads, CSV import — none of it cares who owns the database it
lives in. The blast radius is the edges (auth, storage, process model), not the core.

## The central decision: tenancy model

Three ways to put N customers on shared infrastructure.

### Option A — one shared Postgres, `tenant_id` on every row

The conventional answer. Migrate to Postgres, add `tenant_id` to every table, filter
every query, probably enforce with row-level security.

Rejected. It is the *maximum*-divergence option: it forfeits `better-sqlite3`'s
synchronous driver (which the transaction-plus-FTS design leans on — see the "reads are
synchronous" rule in [02](02-architecture.md)), replaces FTS5 with `tsvector`, touches
every query and mutation in the codebase, and doubles the auth surface of each one — a
single forgotten `WHERE tenant_id =` is a cross-tenant data leak. And the self-hosted
product either migrates to Postgres too (a worse product: two containers, no
single-file backup) or the codebase carries two dialects forever. The roadmap already
rejected Postgres for the product's actual scale; SaaS does not change that per
*library*, only per *fleet*.

### Option B — one SQLite database per tenant

Every tenant gets what a self-hoster has today: their own `librero.db` and their own
`uploads/` prefix. The application code keeps its exact worldview — "the database" is
one household's library — and only the *resolution* of which file to open becomes
per-request.

This is the interesting property: **the multi-tenant hosted product and the
single-tenant self-hosted product run the same queries against the same schema.** No
`tenant_id`, no second dialect, no query-level isolation to get wrong — isolation is a
filesystem boundary, enforced by construction. A cross-tenant leak requires opening the
wrong *file*, one bug class in one resolver function, rather than omitting a filter in
any of a hundred queries.

Costs, honestly:

- `src/db/index.ts` becomes a small LRU pool of handles keyed by tenant instead of one
  `globalThis` handle. `better-sqlite3` handles are cheap to open (~ms) and an idle
  SQLite database consumes only its file size, so a pool of a few hundred open handles
  is nothing.
- Migrations run per tenant file: a fleet migration loop with a version check, instead
  of one `db:migrate`. This is the real new operational surface (see Operations).
- Fleet-wide queries ("how many books across all customers?") need a metrics pipeline,
  not a `SELECT`. Acceptable — that's what the control-plane DB and telemetry are for.
- Backups are per-file — which is actually a feature: Litestream can continuously
  replicate every tenant DB to object storage, and restore/export/delete-my-data are
  all per-tenant file operations. "Download your whole library" falls out for free, and
  it doubles as the *migration path between hosted and self-hosted in both directions* —
  a genuine selling point ("leave whenever you want, take your file").

This pattern has real momentum: [Turso's database-per-tenant model](https://turso.tech/blog/multi-tenancy-at-scale)
and writeups like [uRadical's per-tenant SQLite services](https://uradical.io/latest-news/how-we-build-multi-tenant-services-with-per-tenant-sqlite)
and [this database-per-tenant analysis](https://medium.com/@dmitry.s.mamonov/database-per-tenant-consider-sqlite-9239113c936c)
describe exactly this shape. We don't need Turso itself at launch — plain files on a
volume plus Litestream is enough for hundreds of tenants — but libSQL/Turso is a
credible growth path if the fleet ever needs to outgrow one box.

### Option C — one container per tenant

Zero code changes: provision today's Docker image per customer, orchestrate with Nomad/
K8s/Fly machines. Charged honestly, this is "managed hosting", not SaaS. Idle Node
processes cost real memory per tenant (a Next standalone server is ~150–300 MB
resident), cold starts hurt if you scale-to-zero, and fleet upgrades mean rolling N
deployments. Viable as a *stopgap* to validate demand with the first 10–20 customers
before writing any multi-tenant code — worth taking seriously for exactly that long,
and no longer.

### Recommendation

**Option B**, with Option C as an optional demand-validation phase. It is the smallest
code delta, the strongest isolation-by-construction, and the only option where hosted
and self-hosted remain the same application rather than siblings.

## The architecture, by area

### Process model: app plane vs control plane

Split the product into two applications:

```
                    ┌──────────────────────────────┐
  librero.app  ───► │  control plane (new, private)│  signup, billing, tenant
  (marketing,       │  own small DB (tenants,      │  provisioning, platform
   signup, billing) │  subscriptions, entitlements)│  admin
                    └──────────────┬───────────────┘
                                   │ provisions / suspends
                                   ▼
                    ┌──────────────────────────────┐
  {tenant}.librero.app ──►  app plane (Librero, AGPL)
                    │  resolves tenant from Host   │
                    │  header → opens that tenant's│
                    │  librero.db → serves exactly │
                    │  today's application         │
                    └──────────────────────────────┘
```

- **The app plane is Librero** — this repo, open source, the same image self-hosters
  run. In hosted mode (`LIBRERO_TENANT_MODE=multi`) the tenant resolver maps
  `Host: ana.librero.app` → `/data/tenants/ana/librero.db`. In the default single mode
  the resolver is a constant, and behavior is byte-for-byte today's.
- **The control plane is a separate, private application.** Signup forms, Stripe
  webhooks, the tenants table, plan limits, suspension, the operator dashboard. It
  never touches book data; it writes a small per-tenant manifest (status, plan,
  quotas) that the app plane reads. Keeping it private is what keeps the open-source
  repo free of billing code — the cleanest possible answer to "how do we monetize AGPL
  software without polluting it".

Communication between the two can start embarrassingly simple: the control plane writes
`tenants/{slug}/manifest.json` (or a row in a shared control DB the app plane can read),
and the app plane checks status on session issue. No queues, no service mesh.

### Tenancy in the app plane

The concrete code changes, and they are contained:

1. **`src/db/index.ts`**: replace the single cached handle with
   `getDb(tenant: Tenant)` — an LRU map of open handles, capped (say 200), closing
   least-recently-used. Single mode: the map has one entry, forever. This preserves the
   one-handle-per-database invariant the E2E suite caught (see [08](08-roadmap.md)) —
   per database, not per process.
2. **A tenant resolver**: ~50 lines. Reads the Host header (hosted) or returns the
   static default (self-host). Everything downstream takes the resolved tenant from
   request context (Node `AsyncLocalStorage`, set in the root layout / route handlers).
3. **`src/lib/session.ts`**: add `tenant` to the JWT payload and verify it matches the
   resolved tenant on every request — a session for `ana.librero.app` must be worthless
   at `bob.librero.app`. Cookie domain stays host-only (no `.librero.app` cookie).
4. **Paths**: `LIBRERO_DATA_DIR` becomes `dataDirFor(tenant)`. Uploads, covers, and the
   DB path all already flow through one config point; they gain a tenant segment.

Everything in `src/db/queries/`, `src/db/mutations/`, `src/actions/`, and the entire UI
is untouched. That is the payoff of Option B.

### Identity and auth

Today's model ([05](05-auth-and-roles.md)) is deliberately minimal. Hosted needs more,
and some of it is worth backporting to self-host:

| Change | Hosted | Self-host | Notes |
| --- | --- | --- | --- |
| Self-service signup + email verification | required | absent (operator seeds admin, as today) | Lives in the control plane, not this repo |
| Password reset by email | required | optional (admin reset exists and stays) | Needs the email driver below |
| Server-side session table | required | **backport** | Enables per-session revocation and "sign out everywhere"; fixes a documented limitation. Keep the JWT as the transport; add a session id claim checked against the table |
| Login rate limiting | required | **backport** | Fixed-window counter in SQLite is fine; fixes the other documented limitation |
| Audit log | required | **backport** | `last_login_at` is not enough for a paid product |
| Platform-operator role | required | n/a | Lives in the control plane. Inside a tenant, today's admin/user roles are exactly right and unchanged: the paying customer *is* the tenant admin |
| OAuth / passkeys | later | later | The doc already notes `session.ts` + `auth.ts` are the only two files that would change |

The two-role model survives intact — a hosted tenant is a household, same as a
self-hosted instance. Nothing about per-user private libraries changes; the roadmap's
rejection of that stands independently of SaaS.

### Billing and entitlements

Stripe (Checkout + Billing + customer portal), entirely inside the control plane:

- **Tenant lifecycle**: `trialing → active → past_due → suspended → canceled →
  purge-after-grace`. The app plane only ever sees a boolean-ish status from the
  manifest: `active` (serve), `read_only` (serve, block mutations — the humane
  dunning state), `suspended` (login page with a "billing" message).
- **Entitlements are limits, not features**: books per library, upload storage (GB),
  users per tenant. Enforcement points already exist: `src/actions/books.ts` (add),
  `src/lib/uploads.ts` (size accounting), `src/actions/users.ts` (user count). Each
  gets one `checkQuota(tenant, …)` call whose self-host implementation returns
  `unlimited`. **No feature flags in the open-source app** — the moment the OSS repo
  contains `if (plan >= PRO)`, self-hosting is second-class and the one-codebase rule
  has failed. Feature-flag divergence is how [open-core products end up as separate
  codebases](https://www.getmonetizely.com/articles/whats-the-difference-between-open-core-and-open-source-saas-models);
  limits-only gating is how single-codebase products like
  [GrowthBook](https://www.growthbook.io/blog/best-open-source-feature-flagging-tools-compared) avoid it.
- **Pricing shape** (to validate, not decide here): one paid plan (~$4–6/mo, the
  Fastmail/Pinboard "small honest tool" bracket), 30-day trial, generous limits. A
  free hosted tier is a cost center with no marketing value here — the free tier *is
  self-hosting*.

### Storage

Local disk is wrong for hosted (containers reschedule; quotas need accounting) and
right for self-host. So: a storage driver interface at the two places that touch bytes
— `src/lib/uploads.ts` (ebooks) and the cover store.

```ts
interface FileStore {
  put(key: string, data: Readable, size: number): Promise<void>
  stream(key: string): Promise<Readable>
  delete(key: string): Promise<void>
  usage(prefix: string): Promise<number>   // for quota enforcement
}
```

Two implementations: `LocalFileStore` (today's behavior, default) and `S3FileStore`
(any S3-compatible: R2, B2, Wasabi — egress pricing favors R2/B2). Keys are prefixed
`{tenant}/…` in hosted mode. Downloads switch from streaming the file through Node to
short-lived signed URLs where the backend supports it. The S3 driver ships in the open
repo — it is generically useful to self-hosters on NAS-less setups, which keeps the
one-codebase rule honest: hosted-motivated code that also serves self-hosters lives in
the open.

### Email

One narrow interface (`send(to, template, params)`), two drivers: SMTP (self-host,
optional — the app must keep working with email unconfigured, as today) and an API
provider (Postmark/SES) for hosted. Needed by: password reset, verification, billing
notices (control plane), and eventually loan reminders (a feature, both editions).

### Metadata providers: a genuine hosted advantage

Today every instance pays Open Library's 3–7 s cold lookup ([04](04-metadata-providers.md)).
Hosted, the `metadata_cache` becomes **shared across all tenants** — it holds public
bibliographic data, not customer data, so sharing is safe — and the hundredth customer
scanning *Dune* gets an instant answer. This needs one change: cache reads/writes go
through a small provider-cache service (or simply a shared cache DB file) instead of
the tenant DB. Upstream, the fleet must respect Open Library's rate limits collectively:
one outbound queue with per-provider throttles, not N independent clients. This is the
first place hosted is *better* than self-hosted without self-hosted losing anything —
the honest version of a premium feature.

### Edge and routing

- Wildcard DNS `*.librero.app` + wildcard TLS (Caddy on-demand TLS or a cloud LB).
  Subdomain-per-tenant, not path-per-tenant: cookies, CSP, and the camera's
  secure-origin requirement all get simpler, and it matches the session-tenant binding
  above.
- The camera constraint (HTTPS-only scanning) that makes self-host deployment fiddly
  disappears entirely hosted — another honest selling point.

### Operations

The new surface Option B creates, and the answers:

| Concern | Answer |
| --- | --- |
| Backups | Litestream per tenant DB → object storage, continuous; uploads already in object storage. Restore = copy one file back |
| Fleet migrations | On deploy: iterate tenant manifests, apply `src/db/migrations/` to each (the migration runner already exists — `scripts/migrate.mjs` gains a loop). Lazy variant: migrate on first open after deploy, version-stamped. Prefer eager with lazy as backstop |
| Deploys | The app plane is stateless once storage is external; blue-green on 2+ Node processes behind the LB. Handle pool makes processes disposable |
| Observability | Per-tenant request metrics + error tracking (Sentry), tagged by tenant. Fleet stats from control plane + telemetry, never by querying tenant DBs ad hoc |
| Data export / deletion (GDPR) | Export = their SQLite file + uploads prefix, zipped (CSV export already exists as the portable fallback). Deletion = delete file + prefix + Litestream generations. Both are per-tenant file ops — this is Option B paying rent again |
| Scale ceiling | One beefy box + object storage serves hundreds of tenants (each tenant is a few thousand rows). Past that: shard tenants across app-plane boxes by slug, or adopt libSQL/Turso. Not a launch problem |

### Licensing and the open-core boundary

Current facts: AGPL-3.0, copyright solely Gerson Umanzor, no external contributors yet.
That is the ideal starting position, and worth protecting:

- **AGPL already permits selling hosting** — of your own software, trivially; and
  notably it also means *anyone else* can host Librero commercially if they publish
  their modifications. The moat is the brand, the control plane, and the operations,
  not the license. If that ever feels insufficient, the alternatives (BSL, FSL,
  Elastic-style) are a decision to make *before* the project has many outside
  contributors, not after.
- **Adopt a CLA (or DCO + explicit license grant) before accepting outside
  contributions.** Sole copyright is what preserves the option to dual-license or
  relicense. This is cheap now and impossible later.
- **The boundary rule**: the app plane (this repo) stays AGPL and complete — every
  feature a household needs, no license keys, no phone-home, no `if (plan)`. The
  control plane (billing, provisioning, operator tools) is a separate private repo.
  Interfaces the hosted product needs (storage driver, email driver, tenant resolver,
  quota hook) live in the open repo with working self-host defaults, because they are
  legitimately useful to self-hosters. Precedent: [Plane](https://developers.plane.so/self-hosting/self-hosting-101)
  ships AGPL community + paid editions; [Unleash](https://www.featbit.co/blogs/open-source-feature-flag-tools-2027)
  is AGPL with a hosted offering; GrowthBook runs one codebase for both.

### What self-hosters gain from all this

Worth listing, because it is the test of whether the plan honors "first-class":

- Session revocation, login rate limiting, and an audit log (all currently documented
  limitations — [05](05-auth-and-roles.md), [08](08-roadmap.md))
- An S3 storage driver and an SMTP email driver
- Password reset by email (optional)
- A migration path in both directions: hosted export *is* a self-host data directory,
  and a self-host data directory can be imported into hosted

## Phasing

Each phase ships value on its own; nothing depends on a later phase being certain.

| Phase | Scope | Rough size |
| --- | --- | --- |
| **0 — Validate** (optional) | Landing page + Stripe payment link + manually provisioned per-customer containers (Option C) for the first 10–20 customers. Zero code changes. Kill or continue on real demand | days |
| **1 — Hardening** (all of it benefits self-host) | Session table + revocation, login rate limiting, audit log, storage driver interface + S3 impl, email driver + password reset. Ship as normal Librero releases | ~2–4 weeks |
| **2 — Multi-tenant app plane** | Tenant resolver, per-tenant handle pool, tenant-scoped paths/sessions, fleet migration loop, `LIBRERO_TENANT_MODE`. E2E suite runs in both modes | ~3–5 weeks |
| **3 — Control plane** (private repo) | Tenants DB, signup + verification, Stripe subscriptions + webhooks + dunning states, provisioning, quota manifests, operator dashboard | ~4–6 weeks |
| **4 — Hosted operations** | `*.librero.app` routing + wildcard TLS, Litestream backups, shared metadata cache + upstream throttling, monitoring/alerting, status page, GDPR export/delete runbooks | ~2–4 weeks |
| **5 — Launch** | Pricing page, docs split (hosted vs self-host), migration guides in both directions, support channel | ~1–2 weeks |

Order matters: Phase 1 is pure product improvement even if the SaaS never launches,
which makes it the correct place to start regardless of how Phase 0 goes.

## Open questions

Decisions this document surfaces but does not make:

1. **Validate first?** Run Phase 0's managed-hosting stopgap, or commit to the build?
   (Recommendation: run Phase 0. The cost is days.)
2. **Domain and naming** for the hosted product.
3. **Pricing**: single plan vs. tiers; limits per plan; trial length; annual discount.
4. **License posture**: stay AGPL (recommended for now) vs. move to BSL/FSL while the
   contributor count is still one. Either way, CLA/DCO now.
5. **Region strategy**: single region at launch (recommended) vs. EU data residency as
   a signup option — Option B makes residency *easy later* (a tenant is a file that
   lives somewhere), but the control plane should record the choice from day one.
6. **Shared metadata cache privacy line**: cache is keyed by ISBN/query only; confirm
   nothing tenant-identifying ever lands in it.

## Sources

- [Turso — Multi-tenancy at scale: a database per user](https://turso.tech/blog/multi-tenancy-at-scale)
- [uRadical — How we build multi-tenant services with per-tenant SQLite](https://uradical.io/latest-news/how-we-build-multi-tenant-services-with-per-tenant-sqlite)
- [Dmitry Mamonov — Database-per-tenant: consider SQLite](https://medium.com/@dmitry.s.mamonov/database-per-tenant-consider-sqlite-9239113c936c)
- [Turso database-per-user SaaS pattern](https://www.buildmvpfast.com/blog/turso-database-per-user-multi-tenant-saas-pattern-2026)
- [SQLite at the edge in 2026: Turso, libSQL, D1](https://suparbase.com/blog/sqlite-at-the-edge-2026)
- [Plane — Self-hosting 101 (AGPL community edition + paid editions)](https://developers.plane.so/self-hosting/self-hosting-101)
- [Monetizely — Open core vs open source SaaS models](https://www.getmonetizely.com/articles/whats-the-difference-between-open-core-and-open-source-saas-models)
- [GrowthBook — single codebase for cloud and self-hosted](https://www.growthbook.io/blog/best-open-source-feature-flagging-tools-compared)
