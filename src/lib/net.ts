import "server-only"

import dns from "node:dns/promises"
import net from "node:net"

/*
 * Guard for URLs that a *user* supplies and the *server* then fetches.
 *
 * Librero runs on a home server, so "the server fetches this URL for you" means
 * it can reach the router's admin page, the NAS, every other container on the
 * bridge network, and — on a VPS — the cloud metadata endpoint at
 * 169.254.169.254 that hands out credentials. Every signed-in user would
 * otherwise have a general-purpose probe into the private network the app
 * happens to sit in.
 *
 * Provider URLs (openlibrary.org, googleapis.com) do not go through this: we
 * chose those hosts ourselves.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafeUrlError"
  }
}

/** True when the address is anything other than an ordinary public one. */
export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address)
  if (version === 4) return isPrivateIpv4(address)
  if (version === 6) return isPrivateIpv6(address)
  // Not an IP literal at all — refuse rather than guess.
  return true
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = parts as [number, number, number, number]

  return (
    a === 0 || // "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 0) || // IETF protocol assignments
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  )
}

function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase().split("%")[0]!

  // IPv4-mapped (::ffff:127.0.0.1) inherits the IPv4 rules.
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIpv4(mapped[1]!)

  return (
    value === "::" ||
    value === "::1" || // loopback
    value.startsWith("fc") || // unique local
    value.startsWith("fd") ||
    value.startsWith("fe8") || // link-local
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("ff") // multicast
  )
}

/**
 * Parse and vet a user-supplied URL.
 *
 * Every address the hostname resolves to must be public, not merely the first:
 * a name with both a public and a loopback record would otherwise slip through.
 *
 * Set `allowPrivate` when the operator has opted in — a self-hoster pointing at
 * a Calibre server on their own LAN is a legitimate use, and it is their
 * network.
 *
 * This does not close the DNS-rebinding window between this check and the
 * fetch. Doing so means resolving once and connecting to the literal address
 * with a Host header, which Node's fetch cannot express. For a household app
 * behind a login that trade is proportionate; it is recorded here rather than
 * pretended away.
 */
export async function assertFetchableUrl(
  raw: string,
  options: { allowPrivate?: boolean } = {}
): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError("That is not a valid URL.")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https addresses are supported.")
  }
  if (options.allowPrivate) return url

  const hostname = url.hostname.replace(/^\[|\]$/g, "")

  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new UnsafeUrlError("That address is on a private network.")
    }
    return url
  }

  let addresses: { address: string }[]
  try {
    addresses = await dns.lookup(hostname, { all: true })
  } catch {
    throw new UnsafeUrlError("That host could not be resolved.")
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new UnsafeUrlError("That host resolves to a private network address.")
  }

  return url
}
