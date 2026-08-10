/**
 * Cookie name only — kept in its own module so `middleware.ts` can import it
 * without pulling in `next/headers`, which is unavailable on the edge runtime.
 */
export const SESSION_COOKIE = "librero_session"
