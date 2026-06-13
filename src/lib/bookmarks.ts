import { newId, nowIso } from "./db";
import type { Bookmark } from "./types";
import { domainFromUrl, faviconUrlForDomain, normalizeUrl, normalizeUrlKey } from "./urlNormalize";

type BookmarkRow = {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  url: string;
  normalized_url: string;
  description: string | null;
  favicon_url: string | null;
  sort_order: number;
  is_favourite: number;
  created_at: string;
  updated_at: string;
};

function rowToBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    title: row.title,
    url: row.url,
    description: row.description ?? undefined,
    faviconUrl: row.favicon_url ?? undefined,
    sortOrder: row.sort_order,
    isFavourite: row.is_favourite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DuplicateUrlError extends Error {
  existingTitle: string;

  constructor(existingTitle: string) {
    super(`This URL is already saved as "${existingTitle}".`);
    this.existingTitle = existingTitle;
  }
}

export async function listBookmarks(db: D1Database, userId: string): Promise<Bookmark[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM bookmarks WHERE user_id = ?1 ORDER BY category_id, sort_order, title",
    )
    .bind(userId)
    .all<BookmarkRow>();
  return results.map(rowToBookmark);
}

async function findByNormalizedUrl(
  db: D1Database,
  userId: string,
  normalizedUrl: string,
  excludeId?: string,
): Promise<BookmarkRow | null> {
  const row = await db
    .prepare(
      "SELECT * FROM bookmarks WHERE user_id = ?1 AND normalized_url = ?2 AND id != ?3",
    )
    .bind(userId, normalizedUrl, excludeId ?? "")
    .first<BookmarkRow>();
  return row ?? null;
}

async function nextSortOrder(
  db: D1Database,
  userId: string,
  categoryId: string,
): Promise<number> {
  const row = await db
    .prepare(
      "SELECT MAX(sort_order) AS max_sort FROM bookmarks WHERE user_id = ?1 AND category_id = ?2",
    )
    .bind(userId, categoryId)
    .first<{ max_sort: number | null }>();
  return (row?.max_sort ?? 0) + 10;
}

export type BookmarkInput = {
  title: string;
  url: string;
  categoryId: string;
  description?: string;
  isFavourite?: boolean;
};

export async function createBookmark(
  db: D1Database,
  userId: string,
  input: BookmarkInput,
): Promise<Bookmark> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  const url = normalizeUrl(input.url);
  const normalizedKey = normalizeUrlKey(input.url);

  const duplicate = await findByNormalizedUrl(db, userId, normalizedKey);
  if (duplicate) throw new DuplicateUrlError(duplicate.title);

  const now = nowIso();
  const bookmark: Bookmark = {
    id: newId("bm"),
    userId,
    categoryId: input.categoryId,
    title,
    url,
    description: input.description?.trim() || undefined,
    faviconUrl: faviconUrlForDomain(domainFromUrl(url)),
    sortOrder: await nextSortOrder(db, userId, input.categoryId),
    isFavourite: input.isFavourite ?? false,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .prepare(
      `INSERT INTO bookmarks (id, user_id, category_id, title, url, normalized_url, description, favicon_url, sort_order, is_favourite, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
    .bind(
      bookmark.id,
      bookmark.userId,
      bookmark.categoryId,
      bookmark.title,
      bookmark.url,
      normalizedKey,
      bookmark.description ?? null,
      bookmark.faviconUrl ?? null,
      bookmark.sortOrder,
      bookmark.isFavourite ? 1 : 0,
      bookmark.createdAt,
      bookmark.updatedAt,
    )
    .run();

  return bookmark;
}

export async function updateBookmark(
  db: D1Database,
  userId: string,
  id: string,
  input: BookmarkInput,
): Promise<Bookmark> {
  const row = await db
    .prepare("SELECT * FROM bookmarks WHERE user_id = ?1 AND id = ?2")
    .bind(userId, id)
    .first<BookmarkRow>();
  if (!row) throw new Error("Bookmark not found.");

  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  const url = normalizeUrl(input.url);
  const normalizedKey = normalizeUrlKey(input.url);

  const duplicate = await findByNormalizedUrl(db, userId, normalizedKey, id);
  if (duplicate) throw new DuplicateUrlError(duplicate.title);

  const categoryChanged = input.categoryId !== row.category_id;
  const sortOrder = categoryChanged
    ? await nextSortOrder(db, userId, input.categoryId)
    : row.sort_order;
  const updatedAt = nowIso();

  await db
    .prepare(
      `UPDATE bookmarks SET category_id = ?1, title = ?2, url = ?3, normalized_url = ?4,
         description = ?5, favicon_url = ?6, sort_order = ?7, is_favourite = ?8, updated_at = ?9
       WHERE user_id = ?10 AND id = ?11`,
    )
    .bind(
      input.categoryId,
      title,
      url,
      normalizedKey,
      input.description?.trim() || null,
      faviconUrlForDomain(domainFromUrl(url)),
      sortOrder,
      input.isFavourite ? 1 : 0,
      updatedAt,
      userId,
      id,
    )
    .run();

  return rowToBookmark({
    ...row,
    category_id: input.categoryId,
    title,
    url,
    normalized_url: normalizedKey,
    description: input.description?.trim() || null,
    sort_order: sortOrder,
    is_favourite: input.isFavourite ? 1 : 0,
    updated_at: updatedAt,
  });
}

export async function deleteBookmark(db: D1Database, userId: string, id: string): Promise<void> {
  const result = await db
    .prepare("DELETE FROM bookmarks WHERE user_id = ?1 AND id = ?2")
    .bind(userId, id)
    .run();
  if (!result.meta.changes) throw new Error("Bookmark not found.");
}

/** Find a bookmark by its normalized-url key (for duplicate pre-checks). */
export async function findBookmarkByUrl(
  db: D1Database,
  userId: string,
  url: string,
  excludeId?: string,
): Promise<Bookmark | null> {
  const normalizedKey = normalizeUrlKey(url);
  const row = await findByNormalizedUrl(db, userId, normalizedKey, excludeId);
  return row ? rowToBookmark(row) : null;
}

/**
 * Persist an explicit ordering of bookmarks within a category. Ids not present
 * in the category (or belonging to another user) are ignored.
 */
export async function reorderBookmarks(
  db: D1Database,
  userId: string,
  categoryId: string,
  orderedIds: string[],
): Promise<void> {
  const { results } = await db
    .prepare("SELECT id FROM bookmarks WHERE user_id = ?1 AND category_id = ?2")
    .bind(userId, categoryId)
    .all<{ id: string }>();
  const valid = new Set(results.map((row) => row.id));

  const now = nowIso();
  const statements = orderedIds
    .filter((id) => valid.has(id))
    .map((id, index) =>
      db
        .prepare(
          "UPDATE bookmarks SET sort_order = ?1, category_id = ?2, updated_at = ?3 WHERE user_id = ?4 AND id = ?5",
        )
        .bind((index + 1) * 10, categoryId, now, userId, id),
    );

  if (statements.length) await db.batch(statements);
}

export async function moveBookmark(
  db: D1Database,
  userId: string,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const row = await db
    .prepare("SELECT * FROM bookmarks WHERE user_id = ?1 AND id = ?2")
    .bind(userId, id)
    .first<BookmarkRow>();
  if (!row) throw new Error("Bookmark not found.");

  const { results } = await db
    .prepare(
      "SELECT id, sort_order FROM bookmarks WHERE user_id = ?1 AND category_id = ?2 ORDER BY sort_order, title",
    )
    .bind(userId, row.category_id)
    .all<{ id: string; sort_order: number }>();

  const index = results.findIndex((item) => item.id === id);
  const neighbor = results[direction === "up" ? index - 1 : index + 1];
  if (!neighbor) return; // already first/last

  const current = results[index];
  // Guard against equal sort_order values, which would make a swap a no-op.
  const neighborOrder = neighbor.sort_order === current.sort_order
    ? current.sort_order + (direction === "up" ? -1 : 1)
    : neighbor.sort_order;

  const now = nowIso();
  await db.batch([
    db
      .prepare("UPDATE bookmarks SET sort_order = ?1, updated_at = ?2 WHERE user_id = ?3 AND id = ?4")
      .bind(neighborOrder, now, userId, current.id),
    db
      .prepare("UPDATE bookmarks SET sort_order = ?1, updated_at = ?2 WHERE user_id = ?3 AND id = ?4")
      .bind(current.sort_order, now, userId, neighbor.id),
  ]);
}
