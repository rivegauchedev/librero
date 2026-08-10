import { expect, test } from "@playwright/test"

import { E2E_ADMIN } from "./prepare-database"

/*
 * Lending a copy out and getting it back, through the real forms.
 *
 * The tests share one book and run in order: the loan created by the first is
 * what the second returns.
 */

const TITLE = "A Book To Lend"

test.describe.configure({ mode: "serial" })

test.beforeEach(async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Username").fill(E2E_ADMIN.username)
  await page.getByLabel("Password").fill(E2E_ADMIN.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
})

async function openTheBook(page: import("@playwright/test").Page) {
  await page.goto("/library")
  await page.getByRole("link", { name: new RegExp(TITLE) }).first().click()
  await page.waitForURL(/\/works\/\d+/)
}

test("lend a copy and see it on the loans page", async ({ page }) => {
  // Hand-entered so the copy is guaranteed to exist — lending needs one.
  await page.goto("/library/new")
  await page.getByLabel("Title", { exact: true }).fill(TITLE)
  await page.getByLabel("Authors").fill("Anonymous")
  await page.getByRole("button", { name: "Add to my library" }).click()

  await expect(page).toHaveURL(/\/works\/\d+/, { timeout: 20_000 })

  await page.getByRole("button", { name: "Lend", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Borrower").fill("Ana")
  await dialog.getByRole("button", { name: "Lend", exact: true }).click()

  await expect(dialog).toBeHidden({ timeout: 20_000 })

  // The copy row says where the book went, and the Lend offer is gone.
  await expect(page.getByText("Lent to Ana")).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("button", { name: "Lend", exact: true })).toBeHidden()

  await page.goto("/loans")
  const row = page.getByRole("row", { name: new RegExp(TITLE) })
  await expect(row).toBeVisible()
  await expect(row.getByText("Ana")).toBeVisible()
})

test("a lent-out copy cannot be removed", async ({ page }) => {
  await openTheBook(page)

  await page.getByRole("button", { name: "Remove copy" }).click()

  await expect(page.getByText(/lent out/i)).toBeVisible({ timeout: 20_000 })
  // Still there — the guard refused rather than deleting the loan history.
  await expect(page.getByText("Lent to Ana")).toBeVisible()
})

test("mark it returned from the loans page", async ({ page }) => {
  await page.goto("/loans")
  await page
    .getByRole("button", { name: `Mark ${TITLE} returned by Ana` })
    .click()

  await expect(page.getByRole("row", { name: new RegExp(TITLE) })).toHaveCount(1, {
    timeout: 20_000,
  })
  // The one remaining row is the "Recently returned" entry, not an open loan.
  await expect(page.getByRole("button", { name: /Mark .* returned by Ana/ })).toBeHidden()

  // Back on the book: lendable again, with the past loan kept as history.
  await openTheBook(page)
  await expect(page.getByRole("button", { name: "Lend", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /Loan history \(1\)/ })).toBeVisible()
})
