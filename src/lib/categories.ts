import { newId, nowIso, uncategorisedCategoryId } from "./db";
import type { Category } from "./types";

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "category";
}

export async function listCategories(db: D1Database, userId: string): Promise<Category[]> {
  const { results } = await db
    .prepare("SELECT * FROM categories WHERE user_id = ?1 ORDER BY sort_order, name")
    .bind(userId)
    .all<CategoryRow>();
  return results.map(rowToCategory);
}

export async function getCategory(
  db: D1Database,
  userId: string,
  id: string,
): Promise<Category | null> {
  const row = await db
    .prepare("SELECT * FROM categories WHERE user_id = ?1 AND id = ?2")
    .bind(userId, id)
    .first<CategoryRow>();
  return row ? rowToCategory(row) : null;
}

async function nextSortOrder(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare("SELECT MAX(sort_order) AS max_sort FROM categories WHERE user_id = ?1")
    .bind(userId)
    .first<{ max_sort: number | null }>();
  return (row?.max_sort ?? 0) + 10;
}

async function uniqueSlug(db: D1Database, userId: string, name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const existing = await db
      .prepare("SELECT id FROM categories WHERE user_id = ?1 AND slug = ?2")
      .bind(userId, candidate)
      .first<{ id: string }>();
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
  }
  throw new Error(`Could not find a unique slug for category "${name}".`);
}

export class CategoryExistsError extends Error {
  constructor(name: string) {
    super(`A category named "${name}" already exists.`);
  }
}

export async function createCategory(
  db: D1Database,
  userId: string,
  name: string,
): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");

  const duplicate = await db
    .prepare("SELECT id FROM categories WHERE user_id = ?1 AND name = ?2 COLLATE NOCASE")
    .bind(userId, trimmed)
    .first<{ id: string }>();
  if (duplicate) throw new CategoryExistsError(trimmed);

  const now = nowIso();
  const category: Category = {
    id: newId("cat"),
    userId,
    name: trimmed,
    slug: await uniqueSlug(db, userId, trimmed),
    sortOrder: await nextSortOrder(db, userId),
    createdAt: now,
    updatedAt: now,
  };

  await db
    .prepare(
      "INSERT INTO categories (id, user_id, name, slug, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(
      category.id,
      category.userId,
      category.name,
      category.slug,
      category.sortOrder,
      category.createdAt,
      category.updatedAt,
    )
    .run();

  return category;
}

/** Find a category by name (case-insensitive) or create it. Used by import. */
export async function ensureCategory(
  db: D1Database,
  userId: string,
  name: string,
): Promise<{ category: Category; created: boolean }> {
  const trimmed = name.trim() || "Uncategorised";
  const row = await db
    .prepare("SELECT * FROM categories WHERE user_id = ?1 AND name = ?2 COLLATE NOCASE")
    .bind(userId, trimmed)
    .first<CategoryRow>();
  if (row) return { category: rowToCategory(row), created: false };
  return { category: await createCategory(db, userId, trimmed), created: true };
}

export async function renameCategory(
  db: D1Database,
  userId: string,
  id: string,
  name: string,
): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");

  const existing = await getCategory(db, userId, id);
  if (!existing) throw new Error("Category not found.");

  const duplicate = await db
    .prepare(
      "SELECT id FROM categories WHERE user_id = ?1 AND name = ?2 COLLATE NOCASE AND id != ?3",
    )
    .bind(userId, trimmed, id)
    .first<{ id: string }>();
  if (duplicate) throw new CategoryExistsError(trimmed);

  const slug = slugify(trimmed) === existing.slug ? existing.slug : await uniqueSlug(db, userId, trimmed);

  await db
    .prepare("UPDATE categories SET name = ?1, slug = ?2, updated_at = ?3 WHERE user_id = ?4 AND id = ?5")
    .bind(trimmed, slug, nowIso(), userId, id)
    .run();

  return { ...existing, name: trimmed, slug };
}

/** Deletes a category after moving its bookmarks to Uncategorised. */
export async function deleteCategory(db: D1Database, userId: string, id: string): Promise<void> {
  if (id === uncategorisedCategoryId) {
    throw new Error("The Uncategorised category cannot be deleted.");
  }

  const existing = await getCategory(db, userId, id);
  if (!existing) throw new Error("Category not found.");

  await db.batch([
    db
      .prepare(
        "UPDATE bookmarks SET category_id = ?1, updated_at = ?2 WHERE user_id = ?3 AND category_id = ?4",
      )
      .bind(uncategorisedCategoryId, nowIso(), userId, id),
    db.prepare("DELETE FROM categories WHERE user_id = ?1 AND id = ?2").bind(userId, id),
  ]);
}

export async function moveCategory(
  db: D1Database,
  userId: string,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const ordered = await listCategories(db, userId);
  const index = ordered.findIndex((category) => category.id === id);
  if (index === -1) throw new Error("Category not found.");

  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  const neighbor = ordered[neighborIndex];
  if (!neighbor) return; // already first/last

  const current = ordered[index];
  const now = nowIso();
  await db.batch([
    db
      .prepare("UPDATE categories SET sort_order = ?1, updated_at = ?2 WHERE user_id = ?3 AND id = ?4")
      .bind(neighbor.sortOrder, now, userId, current.id),
    db
      .prepare("UPDATE categories SET sort_order = ?1, updated_at = ?2 WHERE user_id = ?3 AND id = ?4")
      .bind(current.sortOrder, now, userId, neighbor.id),
  ]);
}
