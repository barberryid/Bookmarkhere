import type { Bookmark } from "./types";

/**
 * The generated "Most Used" section. Not a stored category: it is ranked on the
 * fly from favourites + app open-tracking (see migrations/0002, recordOpen).
 *
 * score = (isFavourite ? 1000 : 0)
 *       + visitsLast30Days * 10
 *       + visitsLast90Days * 3
 *       + recencyBoost
 */

export const MOST_USED_LIMIT = 24;
const DAY_MS = 86_400_000;

type UsageRow = {
  bookmark_id: string;
  v30: number;
  v90: number;
  last_opened: string | null;
};

export type Usage = { v30: number; v90: number; lastOpenedAt: string | null };

/**
 * Noisy / temporary URLs that should never surface in Most Used even if opened
 * a lot: search result pages, auth/session/redirect hops, tracking links, and
 * Booking.com session URLs.
 */
export function isNoisyUrl(url: string): boolean {
  let host = "";
  let path = "";
  let search = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    path = u.pathname.toLowerCase();
    search = u.search.toLowerCase();
  } catch {
    return true; // unparseable -> treat as noise
  }

  // Search engines / result pages.
  if (/^(www\.)?google\.[a-z.]+$/.test(host) && (path === "/search" || path.startsWith("/search"))) {
    return true;
  }
  if (host === "google.com" && path.startsWith("/search")) return true;
  if (host === "bing.com" && path.startsWith("/search")) return true;
  if (host === "duckduckgo.com" && (search.includes("q=") || path === "/")) return true;

  // Login / auth / session / logout / redirect hops.
  if (/(^|\/)(login|signin|sign-in|logout|signout|auth|oauth|sso|session|redirect|callback)(\/|$)/.test(path)) {
    return true;
  }

  // Booking.com temporary session URLs carry aid/sid/auth tokens.
  if (host.endsWith("booking.com") && /[?&](aid|sid|auth_key|label)=/.test(search)) {
    return true;
  }

  // Common tracking / redirect query params dominating the URL.
  if (/[?&](utm_|gclid|fbclid|aff_)/.test(search) && search.length > 40) return true;

  return false;
}

export function recencyBoost(lastOpenedAt: string | null, now: number): number {
  if (!lastOpenedAt) return 0;
  const ts = Date.parse(lastOpenedAt);
  if (Number.isNaN(ts)) return 0;
  const days = (now - ts) / DAY_MS;
  if (days <= 1) return 50;
  if (days <= 7) return 25;
  if (days <= 30) return 10;
  return 0;
}

export function scoreBookmark(bookmark: Bookmark, usage: Usage | undefined, now: number): number {
  const u = usage ?? { v30: 0, v90: 0, lastOpenedAt: null };
  return (
    (bookmark.isFavourite ? 1000 : 0) +
    u.v30 * 10 +
    u.v90 * 3 +
    recencyBoost(u.lastOpenedAt, now)
  );
}

/** Aggregate open events into 30/90-day windows keyed by bookmark id. */
export async function loadUsage(db: D1Database, userId: string): Promise<Map<string, Usage>> {
  const now = Date.now();
  const d30 = new Date(now - 30 * DAY_MS).toISOString();
  const d90 = new Date(now - 90 * DAY_MS).toISOString();
  const usage = new Map<string, Usage>();
  try {
    const { results } = await db
      .prepare(
        `SELECT bookmark_id,
                SUM(CASE WHEN opened_at >= ?2 THEN 1 ELSE 0 END) AS v30,
                SUM(CASE WHEN opened_at >= ?3 THEN 1 ELSE 0 END) AS v90,
                MAX(opened_at) AS last_opened
           FROM bookmark_opens
          WHERE user_id = ?1
          GROUP BY bookmark_id`,
      )
      .bind(userId, d30, d90)
      .all<UsageRow>();
    for (const row of results) {
      usage.set(row.bookmark_id, {
        v30: row.v30 ?? 0,
        v90: row.v90 ?? 0,
        lastOpenedAt: row.last_opened,
      });
    }
  } catch {
    // bookmark_opens may not exist yet (pre-migration) — degrade to favourites.
  }
  return usage;
}

/**
 * Rank bookmarks for Most Used and return the ordered ids (highest first).
 * Excludes noisy URLs and anything scoring 0 (no favourite / no usage).
 */
export function rankMostUsed(
  bookmarks: Bookmark[],
  usage: Map<string, Usage>,
  limit = MOST_USED_LIMIT,
): string[] {
  const now = Date.now();
  return bookmarks
    .filter((b) => !isNoisyUrl(b.url))
    .map((b) => ({ b, score: scoreBookmark(b, usage.get(b.id), now) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (usage.get(b.b.id)?.lastOpenedAt ?? "").localeCompare(usage.get(a.b.id)?.lastOpenedAt ?? "") ||
        a.b.title.localeCompare(b.b.title),
    )
    .slice(0, limit)
    .map((entry) => entry.b.id);
}
