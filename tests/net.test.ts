import { describe, expect, it, vi } from "vitest"

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(async (hostname: string) => {
      const table: Record<string, string[]> = {
        "images.example.com": ["93.184.216.34"],
        "covers.openlibrary.org": ["207.241.224.2"],
        // A name that resolves to loopback — the classic DNS-based bypass.
        "evil.example.com": ["127.0.0.1"],
        // Public and private together: the private record must still block it.
        "mixed.example.com": ["93.184.216.34", "10.0.0.5"],
        "v6.example.com": ["2606:2800:220:1:248:1893:25c8:1946"],
        "v6-local.example.com": ["::1"],
      }
      const addresses = table[hostname]
      if (!addresses) throw new Error("ENOTFOUND")
      return addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))
    }),
  },
}))

const { assertFetchableUrl, isPrivateAddress, UnsafeUrlError } = await import("@/lib/net")

describe("isPrivateAddress", () => {
  it("accepts ordinary public addresses", () => {
    expect(isPrivateAddress("93.184.216.34")).toBe(false)
    expect(isPrivateAddress("8.8.8.8")).toBe(false)
    expect(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false)
  })

  it("rejects loopback, private and link-local ranges", () => {
    for (const address of [
      "127.0.0.1",
      "127.1.2.3",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "0.0.0.0",
      "100.64.0.1", // carrier-grade NAT
      "198.18.0.1", // benchmarking
      "224.0.0.1", // multicast
    ]) {
      expect(isPrivateAddress(address), address).toBe(true)
    }
  })

  it("rejects the cloud metadata address", () => {
    // The one that hands out credentials on most hosting providers.
    expect(isPrivateAddress("169.254.169.254")).toBe(true)
  })

  it("rejects private IPv6, including IPv4-mapped loopback", () => {
    for (const address of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1"]) {
      expect(isPrivateAddress(address), address).toBe(true)
    }
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true)
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true)
  })

  it("treats anything that is not an IP as unsafe", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true)
    expect(isPrivateAddress("")).toBe(true)
  })

  it("rejects 172.32, which is outside the private block", () => {
    // Boundary: 172.16–172.31 is private, 172.32 is not.
    expect(isPrivateAddress("172.32.0.1")).toBe(false)
    expect(isPrivateAddress("172.15.0.1")).toBe(false)
  })
})

describe("assertFetchableUrl", () => {
  it("accepts a public https URL", async () => {
    const url = await assertFetchableUrl("https://images.example.com/cover.jpg")
    expect(url.hostname).toBe("images.example.com")
  })

  it("rejects anything that is not http or https", async () => {
    for (const raw of [
      "file:///etc/passwd",
      "ftp://example.com/cover.jpg",
      "data:image/png;base64,iVBORw0KGgo=",
    ]) {
      await expect(assertFetchableUrl(raw)).rejects.toBeInstanceOf(UnsafeUrlError)
    }
  })

  it("rejects a private IP literal", async () => {
    await expect(assertFetchableUrl("http://192.168.1.1/cover.jpg")).rejects.toBeInstanceOf(
      UnsafeUrlError
    )
    await expect(
      assertFetchableUrl("http://169.254.169.254/latest/meta-data/")
    ).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  it("rejects a hostname that resolves to loopback", async () => {
    await expect(assertFetchableUrl("https://evil.example.com/x.jpg")).rejects.toBeInstanceOf(
      UnsafeUrlError
    )
  })

  it("rejects when any resolved address is private, not just the first", async () => {
    await expect(assertFetchableUrl("https://mixed.example.com/x.jpg")).rejects.toBeInstanceOf(
      UnsafeUrlError
    )
  })

  it("rejects a bracketed private IPv6 literal", async () => {
    await expect(assertFetchableUrl("http://[::1]:8080/x.jpg")).rejects.toBeInstanceOf(
      UnsafeUrlError
    )
  })

  it("rejects an unresolvable host", async () => {
    await expect(assertFetchableUrl("https://nowhere.invalid/x.jpg")).rejects.toBeInstanceOf(
      UnsafeUrlError
    )
  })

  it("rejects a malformed URL", async () => {
    await expect(assertFetchableUrl("not a url")).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  it("lets the operator opt in to their own network", async () => {
    // A self-hoster pointing at a Calibre server on their LAN; it is their network.
    const url = await assertFetchableUrl("http://192.168.1.50/cover.jpg", {
      allowPrivate: true,
    })
    expect(url.hostname).toBe("192.168.1.50")
  })
})
