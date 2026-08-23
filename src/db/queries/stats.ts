import "server-only"

import { sqlite } from "@/db"

export type LibraryStats = {
  works: number
  editions: number
  /** Sum of copy quantities — two of the same paperback count as two. */
  copies: number
  physicalCopies: number
  digitalCopies: number
  unread: number
  reading: number
  read: number
  wishlist: number
}

export function getLibraryStats(): LibraryStats {
  const row = sqlite
    .prepare(
      `SELECT
         (SELECT count(*) FROM works WHERE is_wishlist = 0)                       AS works,
         (SELECT count(*) FROM editions)                                          AS editions,
         (SELECT COALESCE(sum(quantity), 0) FROM copies)                          AS copies,
         (SELECT COALESCE(sum(quantity), 0) FROM copies
           WHERE medium = 'physical')                                             AS physicalCopies,
         (SELECT COALESCE(sum(quantity), 0) FROM copies
           WHERE medium = 'digital')                                              AS digitalCopies,
         (SELECT count(*) FROM works
           WHERE is_wishlist = 0 AND reading_status = 'unread')                    AS unread,
         (SELECT count(*) FROM works
           WHERE is_wishlist = 0 AND reading_status = 'reading')                   AS reading,
         (SELECT count(*) FROM works
           WHERE is_wishlist = 0 AND reading_status = 'read')                      AS read,
         (SELECT count(*) FROM works WHERE is_wishlist = 1)                        AS wishlist`
    )
    .get() as LibraryStats

  return row
}

/* ---------------------------------------------------------------- sidebar */

export type NavCounts = {
  works: number
  wishlist: number
  onLoan: number
}

/** The three numbers the sidebar prints beside its links. */
export function getNavCounts(): NavCounts {
  return sqlite
    .prepare(
      `SELECT
         (SELECT count(*) FROM works WHERE is_wishlist = 0)   AS works,
         (SELECT count(*) FROM works WHERE is_wishlist = 1)   AS wishlist,
         (SELECT count(*) FROM loans WHERE returned_at IS NULL) AS onLoan`
    )
    .get() as NavCounts
}
