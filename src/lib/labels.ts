import type {
  CopyMedium,
  EditionFormat,
  FileFormat,
  LoanStatus,
  ReadingStatus,
} from "@/db/schema"

const FORMAT_LABELS: Record<EditionFormat, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  mass_market: "Mass market",
  ebook: "Ebook",
  audiobook: "Audiobook",
  other: "Other",
}

const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
}

const MEDIUM_LABELS: Record<CopyMedium, string> = {
  physical: "Physical",
  digital: "Digital",
}

const FILE_FORMAT_LABELS: Record<FileFormat, string> = {
  epub: "EPUB",
  pdf: "PDF",
  mobi: "MOBI",
  azw3: "AZW3",
  cbz: "CBZ",
  other: "File",
}

const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  pending: "Out",
  returned: "Returned",
}

export function formatLabel(value: string): string {
  return FORMAT_LABELS[value as EditionFormat] ?? value
}

export function readingStatusLabel(value: ReadingStatus): string {
  return READING_STATUS_LABELS[value] ?? value
}

export function mediumLabel(value: CopyMedium): string {
  return MEDIUM_LABELS[value] ?? value
}

export function fileFormatLabel(value: FileFormat): string {
  return FILE_FORMAT_LABELS[value] ?? value
}

export function loanStatusLabel(value: LoanStatus): string {
  return LOAN_STATUS_LABELS[value] ?? value
}

export const FORMAT_OPTIONS = (
  Object.keys(FORMAT_LABELS) as EditionFormat[]
).map((value) => ({ value, label: FORMAT_LABELS[value] }))

export const READING_STATUS_OPTIONS = (
  Object.keys(READING_STATUS_LABELS) as ReadingStatus[]
).map((value) => ({ value, label: READING_STATUS_LABELS[value] }))

export const MEDIUM_OPTIONS = (Object.keys(MEDIUM_LABELS) as CopyMedium[]).map(
  (value) => ({ value, label: MEDIUM_LABELS[value] })
)

export const FILE_FORMAT_OPTIONS = (
  Object.keys(FILE_FORMAT_LABELS) as FileFormat[]
).map((value) => ({ value, label: FILE_FORMAT_LABELS[value] }))

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}
