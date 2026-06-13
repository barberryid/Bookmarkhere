import type { APIRoute } from "astro";
import { json } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { findBookmarkByUrl } from "@lib/bookmarks";
import { getCategory } from "@lib/categories";
import { getDb } from "@lib/db";
import { isValidHttpUrl } from "@lib/urlNormalize";

export const prerender = false;

/** Lightweight duplicate pre-check used by the add/edit dialog on URL blur. */
export const GET: APIRoute = async ({ url }) => {
  const target = url.searchParams.get("url")?.trim();
  const exclude = url.searchParams.get("exclude")?.trim() || undefined;
  if (!target || !isValidHttpUrl(target)) {
    return json({ duplicate: false });
  }

  const db = getDb();
  const userId = getPrivateUserId();
  const existing = await findBookmarkByUrl(db, userId, target, exclude);
  if (!existing) return json({ duplicate: false });

  const category = await getCategory(db, userId, existing.categoryId);
  return json({
    duplicate: true,
    bookmark: { id: existing.id, title: existing.title, categoryId: existing.categoryId },
    categoryName: category?.name ?? "",
  });
};
