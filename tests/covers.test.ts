import fs from "node:fs"
import path from "node:path"
import { afterAll, afterEach, describe, expect, it, vi } from "vitest"

import { createTempDatabase } from "./helpers/temp-db"

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(async (hostname: string) => {
      const table: Record<string, string> = {
        "images.example.com": "93.184.216.34",
        "redirector.example.com": "93.184.216.34",
        "evil.example.com": "127.0.0.1",
      }
      const address = table[hostname]
      if (!address) throw new Error("ENOTFOUND")
      return [{ address, family: 4 }]
    }),
  },
}))

// The covers directory is resolved from the environment at import time.
const temp = createTempDatabase()

const { cacheCoverFromUserUrl, cacheCover, CoverError } = await import("@/lib/covers")

const COVERS_DIR = path.join(temp.dir, "uploads", "covers")

/** A PNG header padded past the 1 KB "this is a placeholder" floor. */
function pngBytes(size = 2048): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(size))
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return bytes
}

function imageResponse(bytes: Uint8Array<ArrayBuffer>, contentType = "image/png") {
  return new Response(bytes, { status: 200, headers: { "Content-Type": contentType } })
}

afterEach(() => vi.unstubAllGlobals())
afterAll(() => temp.cleanup())

describe("cacheCoverFromUserUrl", () => {
  it("downloads an image and stores it under a content-addressed name", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse(pngBytes())))

    const fileName = await cacheCoverFromUserUrl("https://images.example.com/cover.png")

    expect(fileName).toMatch(/^[0-9a-f]{40}\.png$/)
    expect(fs.existsSync(path.join(COVERS_DIR, fileName))).toBe(true)
  })

  it("stores identical images once", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse(pngBytes())))

    const first = await cacheCoverFromUserUrl("https://images.example.com/a.png")
    const second = await cacheCoverFromUserUrl("https://images.example.com/b.png")

    expect(second).toBe(first)
  })

  it("refuses a host on a private network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse(pngBytes())))

    await expect(
      cacheCoverFromUserUrl("http://192.168.1.10/cover.png")
    ).rejects.toBeInstanceOf(CoverError)
    // It never even attempted the request.
    expect(fetch).not.toHaveBeenCalled()
  })

  it("refuses a hostname that resolves to loopback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse(pngBytes())))

    await expect(
      cacheCoverFromUserUrl("https://evil.example.com/cover.png")
    ).rejects.toBeInstanceOf(CoverError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("re-checks the target of a redirect", async () => {
    // The bypass this exists to stop: a public URL that redirects to loopback.
    // `redirect: "follow"` would have chased it without a second thought.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1:9200/_cluster/health" },
        })
      )
    )

    await expect(
      cacheCoverFromUserUrl("https://redirector.example.com/cover.png")
    ).rejects.toBeInstanceOf(CoverError)
  })

  it("follows a redirect to another public address", async () => {
    let call = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1
        if (call === 1) {
          return new Response(null, {
            status: 301,
            headers: { location: "https://images.example.com/real.png" },
          })
        }
        return imageResponse(pngBytes())
      })
    )

    const fileName = await cacheCoverFromUserUrl("https://redirector.example.com/cover.png")
    expect(fileName).toMatch(/\.png$/)
  })

  it("rejects a response that is not an image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html>not a cover</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      )
    )

    await expect(
      cacheCoverFromUserUrl("https://images.example.com/page.html")
    ).rejects.toThrow(/not a JPEG/)
  })

  it("rejects an image larger than 5 MB", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse(pngBytes(6 * 1024 * 1024))))

    await expect(
      cacheCoverFromUserUrl("https://images.example.com/huge.png")
    ).rejects.toThrow(/larger than 5 MB/)
  })

  it("rejects a placeholder too small to be a real cover", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse(pngBytes(64))))

    await expect(
      cacheCoverFromUserUrl("https://images.example.com/1x1.png")
    ).rejects.toThrow(/too small/)
  })

  it("reports the status when the host refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })))

    await expect(
      cacheCoverFromUserUrl("https://images.example.com/missing.png")
    ).rejects.toThrow(/returned 404/)
  })
})

describe("cacheCover — provider path", () => {
  it("returns null instead of throwing, because a missing cover is cosmetic", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })))

    expect(await cacheCover("https://covers.openlibrary.org/b/id/1-L.jpg")).toBeNull()
  })

  it("rejects Open Library's 1x1 no-cover placeholder", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse(pngBytes(100), "image/jpeg")))

    expect(await cacheCover("https://covers.openlibrary.org/b/id/1-L.jpg")).toBeNull()
  })
})
