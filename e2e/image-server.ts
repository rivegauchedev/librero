import http from "node:http"
import zlib from "node:zlib"

const PORT = 3998

export const COVER_IMAGE_URL = `http://127.0.0.1:${PORT}/cover.png`

/**
 * A real PNG, over 1 KB so it clears the "this is a placeholder" floor.
 *
 * Built rather than committed as a binary: a fixture image in the repo would be
 * one more thing to explain, and the bytes only need to be a valid PNG.
 */
function buildPng(): Buffer {
  const width = 60
  const height = 90

  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, "latin1"), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([length, body, crc])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour
  // Each row: one filter byte, then RGB triples.
  //
  // The pixels are deliberately noisy. A flat colour deflates to about 160
  // bytes, which the cover fetcher correctly rejects as too small to be a real
  // cover — Open Library serves a 1x1 placeholder instead of a 404, and that
  // floor exists to catch it. Varying every pixel keeps the file over 1 KB.
  const raw = Buffer.alloc(height * (1 + width * 3))
  let seed = 1
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 256

  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 3)
    raw[offset] = 0
    for (let x = 0; x < width; x++) {
      const pixel = offset + 1 + x * 3
      raw[pixel] = next()
      raw[pixel + 1] = next()
      raw[pixel + 2] = next()
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

let table: number[] | undefined
function crc32(buffer: Buffer): number {
  if (!table) {
    table = Array.from({ length: 256 }, (_, n) => {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      return c
    })
  }
  let crc = 0xffffffff
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return crc ^ 0xffffffff
}

const png = buildPng()

const server = http.createServer((request, response) => {
  if (request.url === "/cover.png") {
    response.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length })
    response.end(png)
    return
  }
  response.writeHead(404).end("not found")
})

/*
 * Only listen when this file is the process entry point.
 *
 * The spec imports COVER_IMAGE_URL from here, and a bare `server.listen()` at
 * module scope would therefore start a second copy inside the Playwright
 * worker — which fails with EADDRINUSE and takes the whole run down with it.
 */
const isEntryPoint = process.argv[1]?.includes("image-server")

if (isEntryPoint) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`E2E image server on ${COVER_IMAGE_URL} (${png.length} bytes)`)
  })
}
