// Re-derives bookmark titles/descriptions from a Booky export file (the
// source of truth) and emits UPDATEs for any stored row that differs.
// Rows are matched by normalized URL. Use after parser fixes to repair
// text that was imported with an older, buggier decoder.
//
// Usage:
//   cmd /c "npx wrangler d1 execute linkshelf --remote --json --command "SELECT id, title, description, normalized_url FROM bookmarks" > bm.json"
//   node scripts/fix-titles-from-export.mjs <export.html> bm.json out.sql
//   wrangler d1 execute linkshelf --remote --file out.sql
import { readFileSync, writeFileSync } from "node:fs";
import { parseNetscapeBookmarks } from "../src/lib/importers/htmlBookmarks.ts";
import { normalizeUrl, normalizeUrlKey, recoverEmbeddedUrl } from "../src/lib/urlNormalize.ts";

const [exportFile, bmFile, outFile] = process.argv.slice(2);
if (!outFile) {
  console.error("Usage: node scripts/fix-titles-from-export.mjs <export.html> <bookmarks.json> <out.sql>");
  process.exit(1);
}

const readText = (file) => {
  const text = readFileSync(file, "utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
};

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

const parsed = parseNetscapeBookmarks(readText(exportFile));
const sourceByUrl = new Map();
for (const item of parsed.items) {
  try {
    let usable = item.url;
    try {
      normalizeUrl(usable);
    } catch {
      usable = recoverEmbeddedUrl(item.url);
      if (!usable) continue;
    }
    // First occurrence wins, matching import dedup behaviour.
    const key = normalizeUrlKey(usable);
    if (!sourceByUrl.has(key)) {
      sourceByUrl.set(key, { title: item.title.slice(0, 500), description: item.description?.trim().slice(0, 1000) || null });
    }
  } catch {
    // skip unparseable source rows
  }
}

const rows = JSON.parse(readText(bmFile))[0].results;
const now = new Date().toISOString();
const statements = [];
let unmatched = 0;

for (const row of rows) {
  const source = sourceByUrl.get(row.normalized_url);
  if (!source) {
    unmatched += 1;
    continue;
  }
  if (source.title !== row.title || source.description !== row.description) {
    statements.push(
      `UPDATE bookmarks SET title = ${q(source.title)}, description = ${source.description ? q(source.description) : "NULL"}, updated_at = ${q(now)} WHERE id = ${q(row.id)};`,
    );
  }
}

writeFileSync(outFile, statements.join("\n"), "utf8");
console.log(JSON.stringify({ dbRows: rows.length, sourceUrls: sourceByUrl.size, updates: statements.length, unmatchedDbRows: unmatched }));
