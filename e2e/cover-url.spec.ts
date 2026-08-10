import { expect, test } from "@playwright/test"

import { E2E_ADMIN } from "./prepare-database"
import { COVER_IMAGE_URL } from "./image-server"

/*
 * Setting a cover from a URL, through the real form.
 *
 * The image is served from a throwaway local HTTP server, which means the URL
 * is a private one — so the suite runs with ALLOW_PRIVATE_COVER_URLS=true and
 * this doubles as the test that the opt-out actually opts out.
 */

test.describe.configure({ mode: "serial" })

test.beforeEach(async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Username").fill(E2E_ADMIN.username)
  await page.getByLabel("Password").fill(E2E_ADMIN.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
})

test("add a book with no cover, then give it one from a URL", async ({ page }) => {
  // A book Open Library has no cover for is hard to guarantee, so start from a
  // hand-entered one: guaranteed coverless, and the case people actually hit.
  await page.goto("/library/new")
  await page.getByLabel("Title", { exact: true }).fill("A Book Without A Cover")
  await page.getByLabel("Authors").fill("Anonymous")
  await page.getByRole("button", { name: "Add to my library" }).click()

  await expect(page).toHaveURL(/\/works\/\d+/, { timeout: 20_000 })
  const workUrl = page.url()

  // The edition offers to take one.
  await expect(page.getByRole("button", { name: "Add cover" })).toBeVisible()
  await page.getByRole("button", { name: "Add cover" }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Edit edition")).toBeVisible()
  await dialog.getByLabel("Cover image URL").fill(COVER_IMAGE_URL)
  await dialog.getByRole("button", { name: "Save edition" }).click()

  await expect(dialog).toBeHidden({ timeout: 20_000 })

  // The cover is served from our own store, not the address that was pasted.
  await page.goto(workUrl)
  const cover = page.locator('img[src^="/api/covers/"]').first()
  await expect(cover).toBeVisible()
  await expect(cover).toHaveAttribute("src", /^\/api\/covers\/[0-9a-f]{40}\.(png|jpg)$/)

  // And the bytes really decoded — a broken <img> is still "visible", and a
  // src attribute alone proves nothing about what the route served.
  await expect
    .poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
})

test("a bad cover URL reports why and leaves the edition alone", async ({ page }) => {
  await page.goto("/library")
  await page.getByRole("link", { name: /A Book Without A Cover/ }).first().click()
  await page.waitForURL(/\/works\/\d+/)

  await page.getByRole("button", { name: "Edit edition" }).click()
  const dialog = page.getByRole("dialog")

  await dialog.getByLabel("Replace the cover").fill("https://example.com/not-an-image.html")
  await dialog.getByRole("button", { name: "Save edition" }).click()

  // The failure is explained rather than swallowed, and the dialog stays open
  // so the address can be corrected.
  await expect(page.getByText(/could not be downloaded|not a JPEG|returned/i)).toBeVisible({
    timeout: 20_000,
  })
  await expect(dialog).toBeVisible()
})

test("a cover can be removed again", async ({ page }) => {
  await page.goto("/library")
  await page.getByRole("link", { name: /A Book Without A Cover/ }).first().click()
  // Wait for the navigation before reading the URL: click() does not, and
  // capturing /library here would make the final assertion look at the whole
  // shelf instead of this one book.
  await page.waitForURL(/\/works\/\d+/)
  const workUrl = page.url()

  await page.getByRole("button", { name: "Edit edition" }).click()
  const dialog = page.getByRole("dialog")

  await dialog.getByRole("button", { name: "Remove cover" }).click()

  // Assert the resulting state, not the toast: a toast is transient, and what
  // matters is that the edition really has no cover now. The field's own label
  // flips from "Replace the cover" once there is nothing to replace.
  await expect(dialog.getByLabel("Cover image URL")).toBeVisible({ timeout: 20_000 })
  await expect(dialog.getByRole("button", { name: "Remove cover" })).toBeHidden()

  await page.goto(workUrl)
  await expect(page.locator('img[src^="/api/covers/"]')).toHaveCount(0)
})
