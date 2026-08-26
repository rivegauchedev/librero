import path from "node:path"

/**
 * Everything mutable lives under one directory so a single Docker volume (and a
 * single tarball) is the whole backup: the SQLite file plus the uploads tree.
 */
export const DATA_DIR = path.resolve(process.env.LIBRERO_DATA_DIR ?? "./data")

export const DB_PATH = process.env.LIBRERO_DB_PATH ?? path.join(DATA_DIR, "librero.db")

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads")
export const COVERS_DIR = path.join(UPLOADS_DIR, "covers")
