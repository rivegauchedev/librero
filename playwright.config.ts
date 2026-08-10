import { defineConfig, devices } from "@playwright/test";

import { E2E_DATA_DIR, prepareDatabase } from "./e2e/prepare-database";
import { prepareStandaloneServer } from "./e2e/prepare-server";

/**
 * The E2E suite runs against a real production server with its own throwaway
 * data directory, so it never touches the database you develop against.
 *
 * The database is prepared here, at config module scope, rather than in
 * `globalSetup` — Playwright starts `webServer` *before* global setup runs, and
 * deleting the data directory out from under a server that has already opened
 * the file leaves it holding an unlinked inode and seeing an empty catalogue.
 */
prepareDatabase();
prepareStandaloneServer();

const PORT = 3999;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      // Serves the cover image the URL test pastes in.
      command: "npx tsx e2e/image-server.ts",
      port: 3998,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // The standalone server, exactly as the Docker image runs it.
      command: "node .next/standalone/server.js",
      // A URL rather than a port: `port` is satisfied by a bare TCP connect, so
      // tests would start before Next had loaded a single route and the first
      // Server Action of the run would eat the whole cold start.
      url: `http://127.0.0.1:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        LIBRERO_DATA_DIR: E2E_DATA_DIR,
        SESSION_SECRET: "e2e-session-secret-long-enough-for-hs256-000000",
        NODE_ENV: "production",
        PORT: String(PORT),
        HOSTNAME: "127.0.0.1",
        // The image server is on loopback, which the cover guard blocks by
        // design. Opting in here is also the test that the opt-in works.
        ALLOW_PRIVATE_COVER_URLS: "true",
      },
    },
  ],
});
