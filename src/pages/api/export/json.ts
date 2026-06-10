import type { APIRoute } from "astro";
import { getPrivateUserId } from "@lib/auth";
import { listBookmarks } from "@lib/bookmarks";
import { listCategories } from "@lib/categories";
import { getDb } from "@lib/db";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const db = getDb();
  const userId = getPrivateUserId();

  const [categories, bookmarks] = await Promise.all([
    listCategories(db, userId),
    listBookmarks(db, userId),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    source: "LinkShelf",
    categories,
    bookmarks,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="linkshelf-bookmarks.json"',
    },
  });
};
