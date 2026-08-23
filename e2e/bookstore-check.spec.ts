import { expect, test, type Page } from "@playwright/test"

import { E2E_ADMIN, E2E_NEWCOMER } from "./prepare-database"

/*
 * The end-to-end path the whole application exists for:
 *
 *   sign in → add a book by ISBN → scan the same ISBN again →
 *   be told you already own it, in which format, and where it is.
 *
 * Runs against a real production server and a real (empty) database, and hits
 * Open Library for the metadata — this is the one test that proves the pieces
 * fit together rather than that each works alone.
 */

const DUNE_ISBN = "9780441013593"
const SHELF = "Office / shelf B3"

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Username").fill(username)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  // The action redirects; without waiting, the next navigation can race it and
  // land back on /login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
}

/** Signs in and lands on the overview — the admin's password is already chosen. */
async function signInAsAdmin(page: Page) {
  await signIn(page, E2E_ADMIN.username, E2E_ADMIN.password)
  await expect(page).toHaveURL("/")
}

// The catalogue is shared state, so the add-then-rescan tests must not
// interleave. Each test still signs in for itself.
test.describe.configure({ mode: "serial" })

test("a temporary password forces a password change before anything else", async ({
  page,
}) => {
  const chosen = "e2e-chosen-password-456"
  await signIn(page, E2E_NEWCOMER.username, E2E_NEWCOMER.password)

  await expect(page).toHaveURL(/\/first-run/)
  await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible()

  await page.getByLabel("Current password").fill(E2E_NEWCOMER.password)
  await page.getByLabel("New password", { exact: true }).fill(chosen)
  await page.getByLabel("Confirm new password").fill(chosen)
  await page.getByRole("button", { name: "Change password" }).click()

  await expect(page).toHaveURL("/")
  // The reading room greets you by name; which greeting depends on the hour.
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening),/ })
  ).toBeVisible()

  // Sign out and back in: the new password works, and the first-run gate stays
  // lifted rather than re-triggering on the next session.
  await page.context().clearCookies()
  await signIn(page, E2E_NEWCOMER.username, chosen)
  await expect(page).toHaveURL("/")
})

test("a wrong password is rejected without saying which field was wrong", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByLabel("Username").fill(E2E_ADMIN.username)
  await page.getByLabel("Password").fill("definitely-not-the-password")
  await page.getByRole("button", { name: "Sign in" }).click()

  // Scoped to the form: Next's route announcer is also role="alert".
  await expect(
    page.locator("form").getByRole("alert")
  ).toHaveText("Incorrect username or password.")
  await expect(page).toHaveURL(/\/login/)
})

test("scan, add, then scan again and be told you already own it", async ({ page }) => {
  await signInAsAdmin(page)

  // --- look the book up -----------------------------------------------------
  await page.goto("/search")
  await page.getByPlaceholder("ISBN, title or author").fill(DUNE_ISBN)
  await page.getByRole("button", { name: "Check" }).click()

  const candidate = page.getByRole("heading", { name: "Dune", exact: true })
  await expect(candidate).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText("Not on your shelf")).toBeVisible()

  // --- add it, as two paperbacks on a named shelf ---------------------------
  await page.getByLabel("Copies").fill("2")
  await page.getByLabel("Where").fill(SHELF)
  await page.getByRole("button", { name: "Add to library" }).click()

  // Generous, and for a real reason: this is the first Server Action of the
  // run, so it loads the action bundle, and it downloads the cover from Open
  // Library before responding. On a slow day that is tens of seconds.
  await expect(page).toHaveURL(/\/works\/\d+/, { timeout: 45_000 })
  await expect(page.getByRole("heading", { name: "Dune", level: 1 })).toBeVisible()
  await expect(page.getByText("Frank Herbert")).toBeVisible()
  // The card under the cover carries where and how many in one line; the green
  // pill carries the verdict. Between them: that you own it, which, and where.
  await expect(page.getByText(`${SHELF} · 2 copies`)).toBeVisible()
  await expect(page.getByText(/On your shelf/)).toBeVisible()

  // --- scan it again: the verdict must flip ---------------------------------
  await page.goto("/search")
  await page.getByPlaceholder("ISBN, title or author").fill(DUNE_ISBN)
  await page.getByRole("button", { name: "Check" }).click()

  await expect(page.getByText("You already own this")).toBeVisible({ timeout: 45_000 })
  // The verdict has to be actionable: which binding, how many, and where.
  await expect(page.getByText("Paperback").first()).toBeVisible()
  await expect(page.getByText("×2").first()).toBeVisible()
  await expect(page.getByText(SHELF).first()).toBeVisible()
})

test("the book appears in the library and the shelf answers a title search", async ({
  page,
}) => {
  await signInAsAdmin(page)

  await page.goto("/library")
  // The shelves view counts the book and the room it was filed into.
  await expect(page.getByText("1 book in 1 room.")).toBeVisible()
  await expect(page.getByRole("link", { name: /Dune/ }).first()).toBeVisible()
  // And it is drawn on the rail for the shelf it was given, not a generic grid.
  await expect(
    page.getByRole("heading", { name: "Office · shelf B3" })
  ).toBeVisible()

  // Searching a bare title must surface your own copy above provider results —
  // Open Library ranks the sequels first, which is why the shelf comes first.
  await page.goto("/search")
  await page.getByPlaceholder("ISBN, title or author").fill("dune")
  await page.getByRole("button", { name: "Check" }).click()

  // The shelf's own answer, in the words the check screen now uses. Asserted on
  // the full sentence: a bare "on your shelf" is a substring of the "Not on your
  // shelf" badge that every provider result below it carries.
  await expect(page.getByText("Yes \u2014 it's already yours")).toBeVisible({
    timeout: 45_000,
  })
})

test("an invalid ISBN is reported as a misread, not looked up", async ({ page }) => {
  await signInAsAdmin(page)

  await page.goto("/search")
  // Correct shape, wrong check digit — the classic barcode misread.
  await page.getByPlaceholder("ISBN, title or author").fill("9780441013539")
  await page.getByRole("button", { name: "Check" }).click()

  await expect(page.getByText("That is not a valid ISBN")).toBeVisible()
})

test("signed-out visitors get nothing", async ({ page }) => {
  await page.context().clearCookies()

  await page.goto("/library")
  await expect(page).toHaveURL(/\/login/)

  const files = await page.request.get("/api/files/1")
  expect(files.status()).toBe(401)

  const lookup = await page.request.get(`/api/lookup?q=${DUNE_ISBN}`)
  expect(lookup.status()).toBe(401)
})
