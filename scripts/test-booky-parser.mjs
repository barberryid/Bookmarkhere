// Run the Booky HTML parser against a real export and print a summary.
// Usage: node scripts/test-booky-parser.mjs "path/to/booky-bookmarks.html"
import { readFileSync } from "node:fs";
import { parseNetscapeBookmarks } from "../src/lib/importers/htmlBookmarks.ts";

const file = process.argv[2];
const raw = readFileSync(file, "utf8");
const result = parseNetscapeBookmarks(raw);

console.log("items:", result.items.length);
console.log("errors:", result.errors);

const categories = new Map();
for (const item of result.items) {
  categories.set(item.categoryName, (categories.get(item.categoryName) ?? 0) + 1);
}
console.log("categories:", categories.size);
console.log("first 12 categories:");
for (const [name, count] of [...categories].slice(0, 12)) {
  console.log(`  ${name}: ${count}`);
}
console.log("sample items:");
for (const item of result.items.slice(0, 5)) {
  console.log(" ", JSON.stringify({ ...item, url: item.url.slice(0, 80) }));
}
const empties = result.items.filter((i) => !i.title || !i.url);
console.log("items with empty title/url:", empties.length);
