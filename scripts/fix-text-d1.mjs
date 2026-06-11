// Repairs HTML entities and double-encoded UTF-8 (mojibake) in bookmark
// titles/descriptions and category names already stored in D1.
//
// Usage:
//   wrangler d1 execute linkshelf --remote --json \
//     --command "SELECT id, title, description FROM bookmarks" > bm.json
//   wrangler d1 execute linkshelf --remote --json \
//     --command "SELECT id, name FROM categories" > cat.json
//   node scripts/fix-text-d1.mjs bm.json cat.json out.sql
//   wrangler d1 execute linkshelf --remote --file out.sql
import { readFileSync, writeFileSync } from "node:fs";
import { cleanText } from "../src/lib/importers/htmlBookmarks.ts";

const [bmFile, catFile, outFile] = process.argv.slice(2);
if (!outFile) {
  console.error("Usage: node scripts/fix-text-d1.mjs <bookmarks.json> <categories.json> <out.sql>");
  process.exit(1);
}

const readJson = (file) => {
  const text = readFileSync(file, "utf8");
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
};

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const now = new Date().toISOString();
const statements = [];
let fixedBookmarks = 0;
let fixedCategories = 0;

for (const row of readJson(bmFile)[0].results) {
  const title = cleanText(row.title);
  const description = row.description ? cleanText(row.description) : null;
  if (title !== row.title || description !== row.description) {
    fixedBookmarks += 1;
    statements.push(
      `UPDATE bookmarks SET title = ${q(title)}, description = ${description ? q(description) : "NULL"}, updated_at = ${q(now)} WHERE id = ${q(row.id)};`,
    );
  }
}

for (const row of readJson(catFile)[0].results) {
  const name = cleanText(row.name);
  if (name !== row.name) {
    fixedCategories += 1;
    statements.push(
      `UPDATE categories SET name = ${q(name)}, updated_at = ${q(now)} WHERE id = ${q(row.id)};`,
    );
  }
}

writeFileSync(outFile, statements.join("\n"), "utf8");
console.log(JSON.stringify({ fixedBookmarks, fixedCategories, statements: statements.length }));
