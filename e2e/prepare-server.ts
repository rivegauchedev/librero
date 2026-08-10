import fs from "node:fs"
import path from "node:path"

/**
 * Assemble the standalone bundle the way the Dockerfile does.
 *
 * `next build` emits `.next/standalone` without the static assets, so
 * `node .next/standalone/server.js` needs `.next/static` and `public` copied
 * alongside it. Running the E2E suite against this — rather than `next start`,
 * which warns that it does not support `output: "standalone"` — means the tests
 * exercise the same server that ships in the image.
 */
export function prepareStandaloneServer(): void {
  const standalone = path.resolve(".next/standalone")

  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    throw new Error(
      'No standalone build found. Run "npm run build" before "npm run test:e2e".'
    )
  }

  fs.cpSync(path.resolve(".next/static"), path.join(standalone, ".next/static"), {
    recursive: true,
  })
  if (fs.existsSync(path.resolve("public"))) {
    fs.cpSync(path.resolve("public"), path.join(standalone, "public"), {
      recursive: true,
    })
  }
}
