import type { APIRoute } from "astro";
import { apiError, json, readJsonBody } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { CategoryExistsError, deleteCategory, renameCategory } from "@lib/categories";
import { getDb } from "@lib/db";

export const prerender = false;

type UpdateBody = {
  name?: string;
};

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const id = params.id;
  if (!id) return apiError("Category id is required.");

  const body = await readJsonBody<UpdateBody>(request);
  if (!body?.name?.trim()) return apiError("Category name is required.");

  const db = getDb();

  try {
    const category = await renameCategory(db, getPrivateUserId(), id, body.name);
    return json({ category });
  } catch (error) {
    if (error instanceof CategoryExistsError) {
      return apiError(error.message, 409);
    }
    if (error instanceof Error && error.message === "Category not found.") {
      return apiError(error.message, 404);
    }
    throw error;
  }
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const id = params.id;
  if (!id) return apiError("Category id is required.");

  const db = getDb();

  try {
    await deleteCategory(db, getPrivateUserId(), id);
    return json({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Category not found.") {
      return apiError(error.message, 404);
    }
    if (error instanceof Error && error.message.includes("cannot be deleted")) {
      return apiError(error.message, 400);
    }
    throw error;
  }
};
