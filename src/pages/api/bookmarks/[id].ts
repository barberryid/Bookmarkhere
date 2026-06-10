import type { APIRoute } from "astro";
import { apiError, json, readJsonBody } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { deleteBookmark, DuplicateUrlError, updateBookmark } from "@lib/bookmarks";
import { getCategory } from "@lib/categories";
import { getDb } from "@lib/db";
import { isValidHttpUrl } from "@lib/urlNormalize";

export const prerender = false;

type UpdateBody = {
  title?: string;
  url?: string;
  categoryId?: string;
  description?: string;
  isFavourite?: boolean;
};

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const id = params.id;
  if (!id) return apiError("Bookmark id is required.");

  const body = await readJsonBody<UpdateBody>(request);
  if (!body) return apiError("Invalid JSON body.");

  const { title, url, categoryId } = body;
  if (!title?.trim()) return apiError("Title is required.");
  if (!url?.trim()) return apiError("URL is required.");
  if (!isValidHttpUrl(url)) return apiError("That doesn't look like a valid web address.");
  if (!categoryId) return apiError("Category is required.");

  const db = getDb();
  const userId = getPrivateUserId();

  if (!(await getCategory(db, userId, categoryId))) {
    return apiError("Category not found.", 404);
  }

  try {
    const bookmark = await updateBookmark(db, userId, id, {
      title,
      url,
      categoryId,
      description: body.description,
      isFavourite: body.isFavourite,
    });
    return json({ bookmark });
  } catch (error) {
    if (error instanceof DuplicateUrlError) {
      return json({ error: error.message, duplicate: true }, 409);
    }
    if (error instanceof Error && error.message === "Bookmark not found.") {
      return apiError(error.message, 404);
    }
    throw error;
  }
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const id = params.id;
  if (!id) return apiError("Bookmark id is required.");

  const db = getDb();
  const userId = getPrivateUserId();

  try {
    await deleteBookmark(db, userId, id);
    return json({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Bookmark not found.") {
      return apiError(error.message, 404);
    }
    throw error;
  }
};
