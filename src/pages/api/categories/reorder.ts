import type { APIRoute } from "astro";
import { apiError, json, readJsonBody } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { moveCategory } from "@lib/categories";
import { getDb } from "@lib/db";

export const prerender = false;

type ReorderBody = {
  id?: string;
  direction?: string;
};

export const POST: APIRoute = async ({ locals, request }) => {
  const body = await readJsonBody<ReorderBody>(request);
  if (!body?.id) return apiError("Category id is required.");
  if (body.direction !== "up" && body.direction !== "down") {
    return apiError('Direction must be "up" or "down".');
  }

  const db = getDb();

  try {
    await moveCategory(db, getPrivateUserId(), body.id, body.direction);
    return json({ moved: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Category not found.") {
      return apiError(error.message, 404);
    }
    throw error;
  }
};
