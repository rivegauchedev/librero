import "server-only"

import { hash, verify } from "@node-rs/argon2"

// Argon2id at the OWASP-recommended baseline for interactive logins.
const OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS)
}

export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS)
  } catch {
    // Malformed hash in the database — treat as a failed login, never a crash.
    return false
  }
}

export const MIN_PASSWORD_LENGTH = 10
