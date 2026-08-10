#!/bin/sh
#
# Bring the data directory up to date before the server starts. Both steps are
# idempotent, so this runs safely on every boot and on every redeploy.
set -e

if [ -z "$SESSION_SECRET" ] || [ ${#SESSION_SECRET} -lt 32 ]; then
  echo "SESSION_SECRET must be set to at least 32 characters." >&2
  echo "Generate one with: openssl rand -base64 48" >&2
  exit 1
fi

mkdir -p "${LIBRERO_DATA_DIR:-/data}/uploads"

echo "Applying database migrations…"
node scripts/migrate.mjs

# Only does anything when the users table is empty.
if [ -n "$ADMIN_PASSWORD" ]; then
  node scripts/seed-admin.mjs
else
  echo "ADMIN_PASSWORD is not set — skipping first-run administrator creation."
fi

exec "$@"
