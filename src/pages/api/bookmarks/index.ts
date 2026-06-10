import type { APIRoute } from "astro";
import { apiError, json, readJsonBody } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { createBookmark, DuplicateUrlError, listBookmarks } from "@lib/bookmarks";
import { getCategory } from "@lib/categories";
import { getDb } from "@lib/db";
import { isValidHttpUrl } from "@lib/urlNormalize";

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const db = getDb();
  const userId = getPrivateUserId();
  const bookmarks = await listBookmarks(db, userId);

  const query = url.searchParams.get("search")?.trim().toLowerCase();
  if (!query) return json({ bookmarks });

  const filtered = bookmarks.filter((bookmark) =>
    [bookmark.title, bookmark.url, bookmark.description ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
  return json({ bookmarks: filtered });
};

type CreateBody = {
  title?: string;
  url?: string;
  categoryId?: string;
  description?: string;
  isFavourite?: boolean;
};

export const POST: APIRoute = async ({ locals, request }) => {
  const body = await readJsonBody<CreateBody>(request);
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
    const bookmark = await createBookmark(db, userId, {
      title,
      url,
      categoryId,
      description: body.description,
      isFavourite: body.isFavourite,
    });
    return json({ bookmark }, 201);
  } catch (error) {
    if (error instanceof DuplicateUrlError) {
      return json({ error: error.message, duplicate: true }, 409);
    }
    throw error;
  }
};
