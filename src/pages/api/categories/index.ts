import type { APIRoute } from "astro";
import { apiError, json, readJsonBody } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { CategoryExistsError, createCategory, listCategories } from "@lib/categories";
import { getDb } from "@lib/db";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const db = getDb();
  const categories = await listCategories(db, getPrivateUserId());
  return json({ categories });
};

type CreateBody = {
  name?: string;
};

export const POST: APIRoute = async ({ locals, request }) => {
  const body = await readJsonBody<CreateBody>(request);
  if (!body?.name?.trim()) return apiError("Category name is required.");

  const db = getDb();

  try {
    const category = await createCategory(db, getPrivateUserId(), body.name);
    return json({ category }, 201);
  } catch (error) {
    if (error instanceof CategoryExistsError) {
      return apiError(error.message, 409);
    }
    throw error;
  }
};
