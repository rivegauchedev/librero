# Build the Librero landing page

You are building a public marketing and documentation landing page for **Librero**, an
open-source, self-hosted book catalogue. You are starting in a **new, empty repository**.
You do not have access to the Librero application source — everything you need to know
about the product is in this brief. Do not invent facts about Librero beyond what is
written here.

---

## 1. Placeholders to resolve first

Fill these in from the values I give you, or leave the exact placeholder token visible in
the code with a `TODO:` comment if I have not given you one. Never guess a real URL.

| Token | Meaning |
| --- | --- |
| `{{REPO_URL}}` | GitHub repository URL for the Librero app |
| `{{SITE_URL}}` | Canonical URL this landing page will be served from |
| `{{SCREENSHOT_DIR}}` | Where I will drop product screenshots (default: `public/screenshots/`) |

If screenshots are not yet available, render tasteful placeholder frames (a bordered,
correctly-proportioned box with a caption naming what belongs there) rather than stock
imagery. Each placeholder must carry a `data-placeholder` attribute so I can find them all
with one search.

---

## 2. What Librero is

*Librero* is Spanish for bookshelf. It is a small, self-hosted catalogue of the books you
own, built to answer one question well:

> You are standing in a bookshop holding a book. Do you already own it?

Scan the barcode and Librero tells you — and, because it models editions properly, it tells
you *which* edition you own, so the hardcover in your hand is a real decision rather than an
accidental second copy.

**The core moment, which the whole page should be built around:** you are in a bookshop, one
hand holding a book, the other holding your phone. You scan. In seconds you get one of four
verdicts:

| Verdict | What it means | What you do |
| --- | --- | --- |
| **You already own this** | Exact ISBN match, and you own at least one copy | Put it back — Librero tells you which shelf your copy is on |
| **You own a different edition** | Same book, different printing | A real decision: it lists the editions you have, so you can weigh the hardcover against the paperback at home |
| **On your wishlist** | You recorded wanting this | Buy it |
| **Not on your shelf** | No match | Add it in one tap, or wishlist it |

Everything else in the application exists to keep those four verdicts accurate.

### Feature list (accurate — use these, add none)

- **Bookstore check** — scan an ISBN barcode with the phone camera, or type a title.
- **Editions and copies modelled honestly** — the same book in paperback and hardcover is
  two editions; two identical paperbacks are one edition with a quantity of two. The data
  model is Work → Edition → Copy.
- **Physical and digital** — record where a physical copy sits on your shelves, or upload
  the EPUB/PDF and download it again from anywhere you are signed in.
- **Metadata for free** — Open Library first, Google Books to fill the gaps. No API key
  required (a free Google key raises quota, nothing more).
- **Reading status, ratings and notes**, per book.
- **Wishlist** — so a bookshop lookup can say "you wanted this".
- **Loans** — lend a copy out and see what is currently out of the house.
- **CSV import/export**, including Goodreads exports. Export re-imports losslessly.
- **Full-text search** across title, author, series and ISBN, with diacritic folding.
- **Accounts** — one shared household library; administrators additionally manage users.
- **Dark and light themes.**

### Design principles worth saying out loud on the page

1. **Answers in seconds, one-handed, on a phone.** The scanner and the verdict are the
   product; the catalogue is the supporting cast.
2. **Own your data.** One SQLite file and one uploads directory, both in a single folder
   you back up. CSV export that re-imports losslessly. No account with anyone, no cloud
   service to lose access to.
3. **Runs on modest hardware.** A Raspberry Pi, a NAS, a small VPS.
4. **Stays small.** A personal bookshelf, not a library management system.

### Be honest about what it is not

Include a short, confident "What Librero is not" section. Being explicit here is a feature,
not an apology — it is how a self-hoster decides quickly.

- Not an integrated library system: no patrons, reservations or fines.
- Not a reading app: uploaded EPUBs are downloaded, not read in the browser.
- No social features: no public reviews, friends or feeds.
- Not public: every page and every file requires a session. There is no anonymous view of
  anyone's library.
- Built for hundreds to a few thousand books. Above that SQLite still copes, but you are
  probably running a library, not a bookshelf.

---

## 3. Audience and goal

The reader is someone comfortable running `docker compose up -d` on a home server, NAS or
VPS — a self-hoster, a homelab person, a developer with too many books. They are skimming.
They want to know, in this order:

1. What problem does this solve, and is it *my* problem?
2. What does it actually look like?
3. How much work is it to run?

The page has exactly two jobs: **showcase the functionality** and **give complete
self-hosting instructions**. Success is a reader who either copies the quick-start block or
opens the repo. There is no signup, no email capture, no hosted plan, no pricing.

---

## 4. Page structure

One page, anchored sections, a sticky compact header with in-page nav. In this order:

1. **Hero.** The bookshop question as the headline. One-sentence subhead. Two buttons:
   "Get started" (jumps to the quick start) and "View on GitHub". Beneath them, a single
   copyable line: `docker compose up -d`. A phone-framed screenshot of the scan verdict
   screen sits alongside — this is the hero image and the most important visual on the page.

2. **The four verdicts.** The table above, rendered as four cards with distinct
   colour-coded status treatment. This is the differentiator; give it room. Do not bury it
   in a generic feature grid.

3. **How it works.** Three or four steps: point the camera → Librero matches the ISBN
   against your shelf → you get the verdict and the shelf location → add, wishlist or walk
   away. Keep it to one short line per step.

4. **Features.** A grid drawn from the feature list above, with a Lucide icon per item.
   Group them so the eye can skim: *Catalogue* (editions and copies, physical and digital,
   metadata, search), *Reading* (status, ratings, notes, wishlist, loans), *Your data* (CSV
   import/export, one-directory backup, accounts).

5. **Editions, explained.** A short section for the one concept that needs teaching, with a
   small diagram: one *Work* ("Dune") → several *Editions* (1965 hardcover, 2021 movie
   tie-in paperback) → *Copies* you actually own (quantity, shelf location, uploaded file).
   Explain in one sentence why this matters: "do I own this book?" and "do I own *this*
   book?" are different questions, and the second is the one that matters at the till.

6. **Screenshots.** A small gallery: the library table, a book detail page with its
   editions, the wishlist, the import wizard. Captions, not decoration — each caption says
   what the screen does.

7. **Self-hosting.** The substantial section; see §5.

8. **Under the hood.** A compact spec table for the reader who wants to know what they are
   running: Next.js 16 (App Router) + React 19 + TypeScript, SQLite via `better-sqlite3`,
   Drizzle ORM with checked-in migrations, SQLite FTS5 for search, Tailwind v4 + shadcn/ui,
   Zod validation, argon2id password hashing with a signed JWT session cookie, Vitest and
   Playwright tests, Docker + Caddy for deployment.

9. **FAQ.** Answer, honestly and briefly: Does it work without internet? (Shelf lookup
   does; metadata lookup needs the network.) Do I need an API key? (No — Open Library
   covers most books; a free Google Books key only raises quota.) Why does the scanner need
   HTTPS? (Browsers only grant camera access on a secure origin.) Can I import from
   Goodreads? (Yes.) How do I back it up? (Copy one directory.) Can other people see my
   library? (No — every route requires a session.) How many books can it hold? (Designed
   for hundreds to a few thousand.)

10. **Footer.** Repo link, documentation link, licence (AGPL-3.0-only), copyright
    "© 2026 Gerson Umanzor".

---

## 5. Self-hosting section — exact content

This must be complete enough to run Librero without leaving the page. Use tabbed or clearly
separated blocks for **Docker** (primary) and **Local development** (secondary). Every code
block needs a working copy button.

**Docker quick start:**

```bash
cp .env.example .env
# Fill in SESSION_SECRET and ADMIN_PASSWORD:
openssl rand -base64 48        # -> SESSION_SECRET

docker compose up -d
```

Then: open `https://localhost` (or your `LIBRERO_HOSTNAME`), sign in with `ADMIN_USERNAME`
and `ADMIN_PASSWORD`, and you are asked to choose a real password immediately.

**Local development:**

```bash
npm install
cp .env.example .env.local     # set SESSION_SECRET and ADMIN_PASSWORD
npm run db:migrate
npm run seed:admin
npm run dev                    # http://localhost:3000
```

**Call out prominently — a highlighted callout, not body text:** HTTPS is not optional if
you want the scanner. Browsers only grant camera access on a secure origin, so a phone
talking to `http://…` cannot scan. The bundled Caddy service handles this automatically; a
real hostname in `LIBRERO_HOSTNAME` gets a Let's Encrypt certificate, and the default gets a
local one. `localhost` counts as a secure origin, so development works on the machine's own
webcam.

**Environment variables table:**

| Variable | Required | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | **yes** | ≥32 characters. The container refuses to start without it. Changing it signs everyone out |
| `ADMIN_PASSWORD` | first run | Temporary; the holder must change it at first sign-in |
| `ADMIN_USERNAME` | no | Default `admin`. Used only when the users table is empty |
| `LIBRERO_HOSTNAME` | no | Caddy's site address. A real domain gets Let's Encrypt automatically |
| `LIBRERO_DATA_DIR` | no | `./data` locally, `/data` in Docker |
| `LIBRERO_CONTACT_EMAIL` | recommended | Sent to Open Library so they can reach you about traffic, per their API policy |
| `GOOGLE_BOOKS_API_KEY` | no | Raises quota only; lookups work without it |
| `MAX_UPLOAD_MB` | no | Default 100 |

**Backup, as its own short block:** `LIBRERO_DATA_DIR` holds `librero.db` and `uploads/`
(covers and ebooks) and nothing else. Back up that one directory and you have backed up the
whole application; there is no other state.

**Requirements line:** Docker and Docker Compose. Runs comfortably on a Raspberry Pi, a NAS
or a small VPS.

---

## 6. Design direction

The app itself uses shadcn/ui in the "new-york" style on a **neutral** base colour, Inter as
the sans-serif, a `0.625rem` radius, and Lucide icons. Match that vocabulary so the site and
the product look like one thing.

- **Tone:** calm, precise, quietly confident. Written like good documentation, not like a
  SaaS pitch. Short sentences. No exclamation marks. No "revolutionise", "seamless",
  "supercharge", "effortlessly".
- **Palette:** near-monochrome neutrals — the product's own palette — with exactly one
  accent, used for the primary CTA and the "already own this" verdict. Restraint is the
  aesthetic. The four verdict cards may each carry a colour, since they encode meaning; the
  rest of the page should not compete with them.
- **Dark and light themes,** both first-class. Respect `prefers-color-scheme`, plus a
  manual toggle in the header persisted to `localStorage`. Every colour must be defined as a
  token in both themes; nothing may be legible in only one.
- **Typography:** one family (Inter, self-hosted — no runtime request to Google Fonts). A
  tight, deliberate scale. Generous line-height in body copy. Real hierarchy carries the
  page; decoration does not.
- **Layout:** mobile-first, max content width around 1100–1200px, generous vertical rhythm,
  sections separated by space rather than by heavy rules or alternating background bands.
- **Motion:** minimal and functional — a subtle fade-and-rise as sections enter the viewport
  at most. Must be fully disabled under `prefers-reduced-motion: reduce`. Nothing that
  moves on its own, no parallax, no autoplaying carousel.
- **A quiet bookshelf motif is welcome** (book-spine rules, a shelf line under the hero) if
  it stays subtle and never becomes clip-art. Skip it entirely rather than doing it
  half-well.

---

## 7. Technical requirements

- **Stack:** Astro or Next.js with static export — your call, but justify it in the README
  in two sentences. Tailwind v4. TypeScript. The build output must be a static site
  deployable to GitHub Pages, Netlify, Vercel or any static host, with no server runtime.
- **No runtime third-party requests.** Self-host fonts and every asset. No analytics, no
  trackers, no CDN scripts, no cookie banner — because there is nothing to consent to.
- **Accessibility, non-negotiable:** semantic landmarks, one `<h1>`, a logical heading
  order, visible keyboard focus, WCAG AA contrast in both themes, alt text on every image,
  copy buttons that announce their result to screen readers, and a working skip link. The
  page must be fully usable at 200% zoom and keyboard-only.
- **Performance:** Lighthouse ≥95 across the board. Images in modern formats, correctly
  sized, lazy-loaded below the fold, with explicit dimensions so nothing shifts. Total JS
  under ~30KB gzipped — this page needs a theme toggle, copy buttons and optional scroll
  reveals, and nothing else.
- **SEO and sharing:** descriptive `<title>` and meta description, canonical URL, Open Graph
  and Twitter card tags, a generated OG image, `robots.txt`, `sitemap.xml`, favicon set, and
  `SoftwareApplication` JSON-LD.
- **Repo hygiene:** a README covering local dev and deploy, a `.gitignore`, a formatter
  config, a working `npm run build`, and a GitHub Actions workflow that builds and deploys
  to Pages. Commit in logical steps with clear messages.

---

## 8. Do not

- Do not invent features, metrics, star counts, download numbers, testimonials, user quotes,
  "trusted by" logos, or a roadmap. If a section would need fabricated social proof to work,
  drop the section.
- Do not add an email capture, waitlist, newsletter, contact form or pricing table.
- Do not describe Librero as a hosted or commercial service. It is self-hosted software
  under AGPL-3.0-only.
- Do not claim it does anything in §2's "what it is not" list.
- Do not overstate scale ("unlimited books", "enterprise-ready"). Say hundreds to a few
  thousand and move on.
- Do not ship placeholder lorem ipsum in visible copy. Write real sentences; use marked
  placeholders only for images I still owe you.

---

## 9. Before you start

Propose the section-by-section outline and your stack choice, and tell me what screenshots
you need from me and at what dimensions. Once I confirm, build the whole thing.

## 10. Definition of done

- [ ] Every section in §4 exists, with real copy.
- [ ] The self-hosting section in §5 is complete and every command is copyable.
- [ ] Light and dark themes both pass WCAG AA, with a working persisted toggle.
- [ ] Keyboard-only navigation reaches every interactive element with visible focus.
- [ ] `prefers-reduced-motion` disables all motion.
- [ ] Lighthouse ≥95 for performance, accessibility, best practices and SEO.
- [ ] No runtime third-party network requests.
- [ ] Renders correctly at 360px, 768px, 1280px and 1920px, and at 200% zoom.
- [ ] `npm run build` produces a deployable static site; CI builds and deploys it.
- [ ] Every unresolved placeholder is marked `TODO:` and listed in the README.
