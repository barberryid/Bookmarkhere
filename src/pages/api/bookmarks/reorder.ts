import type { APIRoute } from "astro";
import { apiError, json, readJsonBody } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { moveBookmark } from "@lib/bookmarks";
import { getDb } from "@lib/db";

export const prerender = false;

type ReorderBody = {
  id?: string;
  direction?: string;
};

export const POST: APIRoute = async ({ locals, request }) => {
  const body = await readJsonBody<ReorderBody>(request);
  if (!body?.id) return apiError("Bookmark id is required.");
  if (body.direction !== "up" && body.direction !== "down") {
    return apiError('Direction must be "up" or "down".');
  }

  const db = getDb();
  const userId = getPrivateUserId();

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
