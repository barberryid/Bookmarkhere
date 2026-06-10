import type { APIRoute } from "astro";
import { getPrivateUserId } from "@lib/auth";
import { listBookmarks } from "@lib/bookmarks";
import { listCategories } from "@lib/categories";
import { getDb } from "@lib/db";

export const prerender = false;

const header = [
  "category",
  "title",
  "url",
  "description",
  "sort_order",
  "is_favourite",
  "created_at",
  "updated_at",
];

export const GET: APIRoute = async ({ locals }) => {
  const db = getDb();
  const userId = getPrivateUserId();

  const [categories, bookmarks] = await Promise.all([
    listCategories(db, userId),
    listBookmarks(db, userId),
  ]);

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const rows = bookmarks.map((bookmark) => [
    categoryNames.get(bookmark.categoryId) ?? "Uncategorised",
    bookmark.title,
    bookmark.url,
    bookmark.description ?? "",
    String(bookmark.sortOrder),
    bookmark.isFavourite ? "true" : "false",
    bookmark.createdAt,
    bookmark.updatedAt,
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="linkshelf-bookmarks.csv"',
    },
  });
};

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
