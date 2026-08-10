/** Rebuild the full-text index from scratch. Safe to run any time. */
import { reindexAll } from "@/db/fts"

console.log(`Reindexed ${reindexAll()} works.`)
