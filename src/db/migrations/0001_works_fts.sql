-- Full-text search over the catalogue.
--
-- A work's searchable text is spread across five tables (works, authors,
-- work_authors, editions, series), so the index is rebuilt per-work by
-- `reindexWork()` inside the same transaction as any mutation, rather than by a
-- web of aggregate triggers. The delete trigger below is the one exception: it
-- catches rows removed by ON DELETE CASCADE, which never passes through
-- application code.
--
-- `unicode61 remove_diacritics 2` folds accents so "Garcia" finds "García".

CREATE VIRTUAL TABLE works_fts USING fts5(
  title,
  subtitle,
  authors,
  isbns,
  series,
  work_id UNINDEXED,
  tokenize = "unicode61 remove_diacritics 2"
);
--> statement-breakpoint
CREATE TRIGGER works_after_delete_fts AFTER DELETE ON works BEGIN
  DELETE FROM works_fts WHERE work_id = old.id;
END;
