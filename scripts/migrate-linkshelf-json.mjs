// Generate a guarded D1 migration from a LinkShelf JSON export. It updates
// categories and bookmark metadata in place, deliberately preserving each
// bookmark ID, its usage counters, and bookmark_opens history for Most Used.
//
// Usage:
//   node scripts/migrate-linkshelf-json.mjs <export.json> <preflight.sql> <migration.sql>
import { readFileSync, writeFileSync } from "node:fs";

const USER_ID = "user_private_seed";
const [inputFile, preflightFile, migrationFile] = process.argv.slice(2);

if (!inputFile || !preflightFile || !migrationFile) {
  console.error("Usage: node scripts/migrate-linkshelf-json.mjs <export.json> <preflight.sql> <migration.sql>");
  process.exit(1);
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

function normaliseUrl(input) {
  const url = new URL(input.trim());
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/" && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  if (url.pathname === "/" && !url.search && !url.hash) return `${url.protocol}//${url.host}`;
  return url.toString();
}

function normaliseUrlKey(input) {
  const url = new URL(normaliseUrl(input));
  return `${url.host}${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`;
}

const data = JSON.parse(readFileSync(inputFile, "utf8"));
if (!Array.isArray(data.categories) || !Array.isArray(data.bookmarks)) {
  throw new Error("Expected a LinkShelf JSON export containing categories and bookmarks arrays.");
}

const categories = data.categories.filter((category) => category.userId === USER_ID);
const bookmarks = data.bookmarks.filter((bookmark) => bookmark.userId === USER_ID);
const categoryIds = new Set(categories.map((category) => category.id));

if (categories.length !== data.categories.length || bookmarks.length !== data.bookmarks.length) {
  throw new Error("The export contains data for an unexpected user.");
}
for (const bookmark of bookmarks) {
  if (!categoryIds.has(bookmark.categoryId)) throw new Error(`Bookmark ${bookmark.id} references a missing category.`);
  normaliseUrl(bookmark.url);
}

const bookmarkIds = bookmarks.map((bookmark) => quote(bookmark.id)).join(", ");
const preflightAssertion = `SELECT CASE WHEN
  (SELECT COUNT(*) FROM bookmarks WHERE user_id = ${quote(USER_ID)}) = ${bookmarks.length}
  AND (SELECT COUNT(*) FROM bookmarks WHERE user_id = ${quote(USER_ID)} AND id IN (${bookmarkIds})) = ${bookmarks.length}
  AND (SELECT COUNT(*) FROM bookmarks WHERE user_id = ${quote(USER_ID)} AND is_favourite = 1) = ${bookmarks.filter((bookmark) => bookmark.isFavourite).length}
  THEN 1 ELSE json_extract('not valid json', '$') END;`;
const preflight = [
  `SELECT
    (SELECT COUNT(*) FROM bookmarks WHERE user_id = ${quote(USER_ID)}) AS live_bookmarks,
    ${bookmarks.length} AS export_bookmarks,
    (SELECT COUNT(*) FROM bookmarks WHERE user_id = ${quote(USER_ID)} AND id IN (${bookmarkIds})) AS matching_bookmark_ids,
    (SELECT COUNT(*) FROM categories WHERE user_id = ${quote(USER_ID)}) AS live_categories,
    ${categories.length} AS export_categories,
    (SELECT COUNT(*) FROM bookmarks WHERE user_id = ${quote(USER_ID)} AND is_favourite = 1) AS live_favourites,
    ${bookmarks.filter((bookmark) => bookmark.isFavourite).length} AS export_favourites;`,
  preflightAssertion,
];

const migration = [
  "PRAGMA foreign_keys = ON;",
  preflightAssertion,
  ...categories.map(
    (category) =>
      `INSERT INTO categories (id, user_id, name, slug, sort_order, created_at, updated_at) VALUES (${quote(category.id)}, ${quote(USER_ID)}, ${quote(category.name)}, ${quote(category.slug)}, ${Number(category.sortOrder)}, ${quote(category.createdAt)}, ${quote(category.updatedAt)}) ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug, sort_order = excluded.sort_order, updated_at = excluded.updated_at;`,
  ),
  ...bookmarks.map(
    (bookmark) =>
      `UPDATE bookmarks SET category_id = ${quote(bookmark.categoryId)}, title = ${quote(bookmark.title.slice(0, 500))}, url = ${quote(normaliseUrl(bookmark.url))}, normalized_url = ${quote(normaliseUrlKey(bookmark.url))}, favicon_url = ${bookmark.faviconUrl ? quote(bookmark.faviconUrl) : "NULL"}, sort_order = ${Number(bookmark.sortOrder)}, is_favourite = ${bookmark.isFavourite ? 1 : 0}, created_at = ${quote(bookmark.createdAt)}, updated_at = ${quote(bookmark.updatedAt)} WHERE user_id = ${quote(USER_ID)} AND id = ${quote(bookmark.id)};`,
  ),
  `DELETE FROM categories WHERE user_id = ${quote(USER_ID)} AND id NOT IN (${categories.map((category) => quote(category.id)).join(", ")});`,
];

writeFileSync(preflightFile, `${preflight.join("\n")}\n`, "utf8");
writeFileSync(migrationFile, `${migration.join("\n")}\n`, "utf8");

console.log(`Prepared ${categories.length} categories and ${bookmarks.length} bookmarks.`);
