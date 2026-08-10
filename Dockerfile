# syntax=docker/dockerfile:1

# Debian slim rather than Alpine: better-sqlite3 and @node-rs/argon2 are native
# modules, and glibc prebuilds exist for both. Alpine's musl would force a
# source build of each on every image rebuild.
ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------- dependencies
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# node-gyp fallback, in case a prebuild is missing for this platform.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------- build
FROM node:${NODE_VERSION} AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# No SESSION_SECRET here on purpose: every route is dynamic, so nothing reads
# it during the build, and a placeholder in an image layer is a placeholder
# someone eventually ships as a real secret.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# -------------------------------------------------------------------- runtime
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# sqlite3 for scripts/backup.sh; tini so signals reach node and the container
# stops cleanly instead of waiting out the timeout.
RUN apt-get update \
 && apt-get install -y --no-install-recommends sqlite3 tini \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV LIBRERO_DATA_DIR=/data

# The standalone bundle omits node_modules, so the native modules Next marked
# external have to be copied in alongside it.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# The boot scripts and the one library they need. They are plain .mjs precisely
# so the runtime image does not have to ship tsx and esbuild to run them.
COPY --from=build /app/src/db/migrations ./src/db/migrations
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The volume is created by the host, so the app user must own what it writes.
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
