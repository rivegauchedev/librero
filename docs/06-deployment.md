# 06 — Deployment

## Everything is one directory

`LIBRERO_DATA_DIR` — `./data` locally, `/data` in the container — holds:

```
data/
  librero.db          the entire catalogue
  librero.db-wal      WAL journal
  librero.db-shm
  uploads/
    covers/           content-addressed cover images
    books/<copyId>/   uploaded ebooks
```

There is no other state. Back up that directory and you have backed up Librero.

## Docker Compose

```bash
cp .env.example .env
openssl rand -base64 48        # -> SESSION_SECRET in .env
# set ADMIN_PASSWORD too, and LIBRERO_HOSTNAME if you have a real domain

docker compose up -d
docker compose logs -f librero
```

Two services:

- **librero** — the app. Deliberately *not* published to the host: only Caddy can reach
  it, so there is no way to hit it over plain HTTP by accident.
- **caddy** — TLS termination on 80/443.

The entrypoint runs migrations and the admin seed on every boot. Both are idempotent, so a
redeploy is just `docker compose up -d --build`.

### Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | **yes** | ≥32 chars. The entrypoint refuses to start without it. Changing it signs everyone out |
| `ADMIN_USERNAME` | no | Default `admin`. Used only when the users table is empty |
| `ADMIN_PASSWORD` | first run | Temporary; the holder must change it at first sign-in |
| `LIBRERO_HOSTNAME` | no | Caddy's site address. A real domain gets Let's Encrypt automatically |
| `LIBRERO_CONTACT_EMAIL` | recommended | Sent in the User-Agent to Open Library, per their API policy |
| `GOOGLE_BOOKS_API_KEY` | no | Raises quota only; lookups work without it |
| `MAX_UPLOAD_MB` | no | Default 100 |

### Why the image is Debian, not Alpine

`better-sqlite3` and `@node-rs/argon2` are native modules with glibc prebuilds. On Alpine,
musl forces a source compile of both on every rebuild, for a saving of maybe 40 MB.

Two consequences worth knowing if you edit the Dockerfile:

1. Those two packages are listed in `serverExternalPackages`, so Next does not bundle
   them — which means the standalone output does not contain them either, and the runtime
   stage has to copy them in.
2. `tsx` and `drizzle-orm` are also copied into the runtime image, because the entrypoint
   runs the migration script.

## HTTPS is required for the scanner

Browsers only expose `getUserMedia` on a secure origin. Over plain HTTP from a phone, the
camera is simply unavailable and the scanner degrades to manual ISBN entry with an
explanatory message.

Three ways to get a secure origin, in order of how well they suit a home install:

**Tailscale Serve** — easiest, and nothing is exposed to the internet:

```bash
tailscale serve --bg https / http://127.0.0.1:3000
```

Then drop the `caddy` service and publish `3000:3000` from the `librero` service instead.
You get a valid `*.ts.net` certificate and the instance is only reachable on your tailnet.

**Caddy with a real domain** — set `LIBRERO_HOSTNAME=books.example.com`, point DNS at the
host, open 80 and 443. Certificates are automatic. This does put a login page on the
public internet; see the rate-limiting caveat in [05-auth-and-roles](05-auth-and-roles.md).

**Caddy on a LAN** — the default. Caddy issues a certificate from its own local CA; you
must install its root certificate on each phone or the browser will refuse the camera.
Workable, but fiddlier than Tailscale.

## Backups

```bash
./scripts/backup.sh /var/backups/librero
```

Writes `librero-backup-YYYY-MM-DD-HHMMSS.tar.gz` containing the database and uploads, and
prunes to the most recent 14 archives (`LIBRERO_BACKUP_KEEP`).

It uses `sqlite3 .backup`, not `cp`. Copying a live WAL-mode database can capture a torn
page and restore as a corrupt file; `.backup` takes a consistent snapshot of a database
that is being written to.

Nightly, from the host:

```cron
15 3 * * * cd /srv/librero && ./scripts/backup.sh /var/backups/librero >> /var/log/librero-backup.log 2>&1
```

Inside the container instead (`sqlite3` is installed there):

```bash
docker compose exec librero ./scripts/backup.sh /data/backups
```

### Restore

```bash
docker compose down
docker run --rm -v librero_librero-data:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar -xzf /backup/librero-backup-….tar.gz -C /data --strip-components=1'
docker compose up -d
```

**Test this before you need it.** A backup you have never restored is a hypothesis.

## Running without Docker

```bash
npm ci
npm run build
npm run db:migrate
npm run seed:admin
SESSION_SECRET=… LIBRERO_DATA_DIR=/var/lib/librero npm start
```

Put a reverse proxy in front for TLS. `npm start` binds to `0.0.0.0:3000` by default;
`PORT` and `HOSTNAME` override it.

## Upgrading

```bash
git pull
docker compose up -d --build
```

Migrations run on boot. Take a backup first — migrations are not reversible, and the
restore path above is the rollback.

## Health

`GET /api/health` returns `{"status":"ok"}` when the process is up and the database
answers. It is unauthenticated so the container healthcheck can use it, and reveals
nothing else.
