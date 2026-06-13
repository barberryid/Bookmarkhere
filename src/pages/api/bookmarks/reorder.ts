import type { APIRoute } from "astro";
import { apiError, json, readJsonBody } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { moveBookmark, reorderBookmarks } from "@lib/bookmarks";
import { getDb } from "@lib/db";

export const prerender = false;

type ReorderBody = {
  id?: string;
  direction?: string;
  categoryId?: string;
  order?: string[];
};

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<ReorderBody>(request);
  if (!body) return apiError("Invalid JSON body.");

  const db = getDb();
  const userId = getPrivateUserId();

  // Bulk ordering (drag-and-drop): a full ordered id list for one category.
  if (Array.isArray(body.order)) {
    if (!body.categoryId) return apiError("categoryId is required for bulk reorder.");
    await reorderBookmarks(db, userId, body.categoryId, body.order);
    return json({ reordered: true });
  }

  // Single step (up/down buttons, keyboard).
  if (!body.id) return apiError("Bookmark id is required.");
  if (body.direction !== "up" && body.direction !== "down") {
    return apiError('Direction must be "up" or "down".');
  }

  try {
    await moveBookmark(db, userId, body.id, body.direction);
    return json({ moved: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Bookmark not found.") {
      return apiError(error.message, 404);
    }
    throw error;
  }
};
