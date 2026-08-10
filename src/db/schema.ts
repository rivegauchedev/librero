import { sql, relations } from "drizzle-orm"
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

/*
 * Librero's catalogue is three levels deep:
 *
 *   Work     the book as an idea      "Dune" by Frank Herbert
 *    └ Edition  a specific publication   Ace 2010 paperback, ISBN 9780441013593
 *       └ Copy    a thing you own          hardcover on shelf B3, x2  |  an EPUB on disk
 *
 * That split is what lets the bookstore check answer "you own this book, but in
 * paperback — the one in your hand is the hardcover".
 */

export const READING_STATUSES = ["unread", "reading", "read"] as const
export const EDITION_FORMATS = [
  "hardcover",
  "paperback",
  "mass_market",
  "ebook",
  "audiobook",
  "other",
] as const
export const COPY_MEDIA = ["physical", "digital"] as const
export const FILE_FORMATS = ["epub", "pdf", "mobi", "azw3", "cbz", "other"] as const
export const CONTRIBUTOR_ROLES = [
  "author",
  "translator",
  "illustrator",
  "editor",
] as const
export const METADATA_SOURCES = ["openlibrary", "googlebooks", "manual"] as const
/** Derived from loans.returned_at, never stored — see the loans table. */
export const LOAN_STATUSES = ["pending", "returned"] as const
export const ROLES = ["admin", "user"] as const

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}

/* ------------------------------------------------------------------ users */

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ROLES }).notNull().default("user"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(false),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_username_unique").on(sql`lower(${t.username})`)]
)

/* ------------------------------------------------------------------ works */

export const works = sqliteTable(
  "works",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    /** Title with leading articles stripped, for alphabetical browsing. */
    sortTitle: text("sort_title").notNull(),
    /** Aggressively normalized title used by fuzzy ownership matching. */
    matchKey: text("match_key").notNull(),
    originalLanguage: text("original_language"),
    firstPublishYear: integer("first_publish_year"),
    description: text("description"),
    openLibraryWorkId: text("open_library_work_id"),
    readingStatus: text("reading_status", { enum: READING_STATUSES })
      .notNull()
      .default("unread"),
    /** 1-5, or null when unrated. */
    rating: integer("rating"),
    dateFinished: integer("date_finished", { mode: "timestamp" }),
    notes: text("notes"),
    /** A wanted-but-not-owned book: flagged here, with zero copies. */
    isWishlist: integer("is_wishlist", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("works_ol_work_unique").on(t.openLibraryWorkId),
    index("works_match_key_idx").on(t.matchKey),
    index("works_sort_title_idx").on(t.sortTitle),
    index("works_wishlist_idx").on(t.isWishlist),
  ]
)

/* ------------------------------------------------- authors & contributions */

export const authors = sqliteTable(
  "authors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    sortName: text("sort_name").notNull(),
    /** Lowercased surname, used by ownership matching. */
    matchKey: text("match_key").notNull(),
    openLibraryAuthorId: text("open_library_author_id"),
  },
  (t) => [
    uniqueIndex("authors_name_unique").on(sql`lower(${t.name})`),
    index("authors_match_key_idx").on(t.matchKey),
  ]
)

export const workAuthors = sqliteTable(
  "work_authors",
  {
    workId: integer("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
    role: text("role", { enum: CONTRIBUTOR_ROLES }).notNull().default("author"),
    /** 0 is the primary author — the one ownership matching keys on. */
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.workId, t.authorId, t.role] }),
    index("work_authors_author_idx").on(t.authorId),
  ]
)

/* ----------------------------------------------------------------- series */

export const series = sqliteTable(
  "series",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("series_name_unique").on(sql`lower(${t.name})`)]
)

export const workSeries = sqliteTable(
  "work_series",
  {
    workId: integer("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    seriesId: integer("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    /** Real-typed so "book 2.5" works. */
    position: real("position"),
  },
  (t) => [
    primaryKey({ columns: [t.workId, t.seriesId] }),
    index("work_series_series_idx").on(t.seriesId),
  ]
)

/* ------------------------------------------------------------------- tags */

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tags_name_unique").on(sql`lower(${t.name})`)]
)

export const workTags = sqliteTable(
  "work_tags",
  {
    workId: integer("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.workId, t.tagId] }),
    index("work_tags_tag_idx").on(t.tagId),
  ]
)

/* --------------------------------------------------------------- editions */

export const editions = sqliteTable(
  "editions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workId: integer("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    /** Digits only, no hyphens. Either may be null — plenty of books have no ISBN. */
    isbn10: text("isbn10"),
    isbn13: text("isbn13"),
    /** Edition title, when the publisher's differs from the work's. */
    title: text("title"),
    publisher: text("publisher"),
    publishYear: integer("publish_year"),
    pageCount: integer("page_count"),
    language: text("language"),
    format: text("format", { enum: EDITION_FORMATS }).notNull().default("paperback"),
    /** Free text: "Folio Society illustrated", "10th Anniversary", "signed". */
    editionNote: text("edition_note"),
    /** Path under the uploads dir; covers are cached locally, never hotlinked. */
    coverPath: text("cover_path"),
    coverSourceUrl: text("cover_source_url"),
    openLibraryEditionId: text("open_library_edition_id"),
    metadataSource: text("metadata_source", { enum: METADATA_SOURCES })
      .notNull()
      .default("manual"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("editions_isbn13_unique").on(t.isbn13),
    index("editions_isbn10_idx").on(t.isbn10),
    index("editions_work_idx").on(t.workId),
  ]
)

/* ----------------------------------------------------------------- copies */

export const copies = sqliteTable(
  "copies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    medium: text("medium", { enum: COPY_MEDIA }).notNull().default("physical"),
    /** How many of this exact edition you own. */
    quantity: integer("quantity").notNull().default(1),
    condition: text("condition"),
    acquiredDate: integer("acquired_date", { mode: "timestamp" }),
    /** Stored in cents to avoid float drift. */
    purchasePriceCents: integer("purchase_price_cents"),
    /** Free text: "Office / shelf B3". */
    location: text("location"),
    notes: text("notes"),

    /* Digital copies only. */
    fileName: text("file_name"),
    /** Relative to UPLOADS_DIR — never a client-supplied absolute path. */
    filePath: text("file_path"),
    fileSizeBytes: integer("file_size_bytes"),
    fileFormat: text("file_format", { enum: FILE_FORMATS }),
    /** For digital copies you own but cannot upload: "kindle", "audible", "kobo". */
    externalService: text("external_service"),

    ...timestamps,
  },
  (t) => [index("copies_edition_idx").on(t.editionId)]
)

/* ---------------------------------------------------------------- loans */

/*
 * Lending a copy out. `status` is deliberately not a column: a loan is open
 * exactly while `returned_at` is null, and the partial unique index below
 * already depends on that, so a second flag could only ever disagree with it.
 */
export const loans = sqliteTable(
  "loans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    copyId: integer("copy_id")
      .notNull()
      .references(() => copies.id, { onDelete: "cascade" }),
    borrowerName: text("borrower_name").notNull(),
    borrowedAt: integer("borrowed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** Null while the book is still out — this is what "pending" means. */
    returnedAt: integer("returned_at", { mode: "timestamp" }),
    notes: text("notes"),

    ...timestamps,
  },
  (t) => [
    index("loans_copy_idx").on(t.copyId),
    /*
     * One open loan per copy — but only open ones, so the same copy can be
     * lent again once it comes back. The predicate is raw SQL on purpose:
     * a column reference renders table-qualified, which SQLite rejects
     * inside a partial index.
     */
    uniqueIndex("loans_open_copy_unique")
      .on(t.copyId)
      .where(sql`returned_at is null`),
  ]
)

/* --------------------------------------------------------- metadata cache */

export const metadataCache = sqliteTable(
  "metadata_cache",
  {
    provider: text("provider").notNull(),
    /** Provider-specific lookup key: "isbn:9780441013593", "search:dune". */
    key: text("key").notNull(),
    payload: text("payload").notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.key] })]
)

/* -------------------------------------------------------------- relations */

export const worksRelations = relations(works, ({ many }) => ({
  editions: many(editions),
  authors: many(workAuthors),
  series: many(workSeries),
  tags: many(workTags),
}))

export const editionsRelations = relations(editions, ({ one, many }) => ({
  work: one(works, { fields: [editions.workId], references: [works.id] }),
  copies: many(copies),
}))

export const copiesRelations = relations(copies, ({ one, many }) => ({
  edition: one(editions, { fields: [copies.editionId], references: [editions.id] }),
  loans: many(loans),
}))

export const loansRelations = relations(loans, ({ one }) => ({
  copy: one(copies, { fields: [loans.copyId], references: [copies.id] }),
}))

export const workAuthorsRelations = relations(workAuthors, ({ one }) => ({
  work: one(works, { fields: [workAuthors.workId], references: [works.id] }),
  author: one(authors, { fields: [workAuthors.authorId], references: [authors.id] }),
}))

export const authorsRelations = relations(authors, ({ many }) => ({
  works: many(workAuthors),
}))

export const workSeriesRelations = relations(workSeries, ({ one }) => ({
  work: one(works, { fields: [workSeries.workId], references: [works.id] }),
  series: one(series, { fields: [workSeries.seriesId], references: [series.id] }),
}))

export const seriesRelations = relations(series, ({ many }) => ({
  works: many(workSeries),
}))

export const workTagsRelations = relations(workTags, ({ one }) => ({
  work: one(works, { fields: [workTags.workId], references: [works.id] }),
  tag: one(tags, { fields: [workTags.tagId], references: [tags.id] }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  works: many(workTags),
}))

/* ---------------------------------------------------------------- exports */

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Work = typeof works.$inferSelect
export type NewWork = typeof works.$inferInsert
export type Author = typeof authors.$inferSelect
export type Edition = typeof editions.$inferSelect
export type NewEdition = typeof editions.$inferInsert
export type Copy = typeof copies.$inferSelect
export type NewCopy = typeof copies.$inferInsert
export type Loan = typeof loans.$inferSelect
export type NewLoan = typeof loans.$inferInsert

export type ReadingStatus = (typeof READING_STATUSES)[number]
export type EditionFormat = (typeof EDITION_FORMATS)[number]
export type CopyMedium = (typeof COPY_MEDIA)[number]
export type FileFormat = (typeof FILE_FORMATS)[number]
export type MetadataSource = (typeof METADATA_SOURCES)[number]
export type LoanStatus = (typeof LOAN_STATUSES)[number]
