/**
 * Drop every cached Open Library / Google Books response.
 *
 * Useful after upgrading, or when a provider outage left thin records behind:
 * the catalogue itself is untouched, only the lookup cache is emptied and it
 * refills on the next search.
 */
import { clearCache } from "@/lib/providers/cache"

console.log(`Cleared ${clearCache()} cached provider responses.`)
