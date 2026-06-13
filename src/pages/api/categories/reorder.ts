import type { APIRoute } from "astro";
import { apiError, json, readJsonBody } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { moveCategory, reorderCategories } from "@lib/categories";
import { getDb } from "@lib/db";

export const prerender = false;

type ReorderBody = {
  id?: string;
  direction?: string;
  order?: string[];
};

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody<ReorderBody>(request);
  if (!body) return apiError("Invalid JSON body.");

  const db = getDb();
  const userId = getPrivateUserId();

  // Bulk ordering (drag-and-drop): a full ordered id list.
  if (Array.isArray(body.order)) {
    await reorderCategories(db, userId, body.order);
    return json({ reordered: true });
  }

  // Single step (up/down buttons).
  if (!body.id) return apiError("Category id is required.");
  if (body.direction !== "up" && body.direction !== "down") {
    return apiError('Direction must be "up" or "down".');
  }

  try {
    await moveCategory(db, userId, body.id, body.direction);
    return json({ moved: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Category not found.") {
      return apiError(error.message, 404);
    }
    throw error;
  }
};
