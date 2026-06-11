// Generates SQL to import a Booky.io HTML export into the D1 bookmarks
// database, mirroring the /api/import/booky endpoint logic. Used for the
// production import where the HTTP endpoint sits behind Cloudflare Access.
//
// Usage:
//   wrangler d1 execute linkshelf --remote --json \
//     --command "SELECT id, name, slug, sort_order FROM categories" > cats.json
//   wrangler d1 execute linkshelf --remote --json \
//     --command "SELECT normalized_url FROM bookmarks" > urls.json
//   node scripts/import-booky-to-d1.mjs <export.html> <cats.json> <urls.json> <out.sql>
//   wrangler d1 execute linkshelf --remote --file <out.sql>
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseNetscapeBookmarks } from "../src/lib/importers/htmlBookmarks.ts";
import {
  domainFromUrl,
  faviconUrlForDomain,
  normalizeUrl,
  normalizeUrlKey,
  recoverEmbeddedUrl,
} from "../src/lib/urlNormalize.ts";

const USER_ID = "user_private_seed";

const [exportFile, catsFile, urlsFile, outFile] = process.argv.slice(2);
if (!outFile) {
  console.error("Usage: node scripts/import-booky-to-d1.mjs <export.html> <cats.json> <urls.json> <out.sql>");
  process.exit(1);
}

// Local copy of src/lib/categories.ts slugify (that module imports
// cloudflare:workers and cannot run under plain Node).
function slugify(name) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "category";
}

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

const readText = (file) => {
  const text = readFileSync(file, "utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
};

const parsed = parseNetscapeBookmarks(readText(exportFile));
const existingCategories = JSON.parse(readText(catsFile))[0].results;
const existingUrls = JSON.parse(readText(urlsFile))[0].results;

const categoriesByName = new Map(
  existingCategories.map((row) => [row.name.toLowerCase(), row]),
);
const usedSlugs = new Set(existingCategories.map((row) => row.slug));
let nextCategorySort = Math.max(0, ...existingCategories.map((row) => row.sort_order)) + 10;

const seenUrls = new Set(existingUrls.map((row) => row.normalized_url));
const sortCounters = new Map();

const now = new Date().toISOString();
const statements = [];
const summary = { found: parsed.items.length, imported: 0, skippedDuplicates: 0, categoriesCreated: 0, errors: [...parsed.errors] };

for (const item of parsed.items) {
  let url;
  let normalizedKey;
  try {
    let usable = item.url;
    try {
      normalizeUrl(usable);
    } catch {
      usable = recoverEmbeddedUrl(item.url);
      if (!usable) throw new Error("invalid");
    }
    url = normalizeUrl(usable);
    normalizedKey = normalizeUrlKey(usable);
  } catch {
    summary.errors.push(`Skipped invalid URL: ${item.url.slice(0, 120)}`);
    continue;
  }

  if (seenUrls.has(normalizedKey)) {
    summary.skippedDuplicates += 1;
    continue;
  }
  seenUrls.add(normalizedKey);

  let category = categoriesByName.get(item.categoryName.toLowerCase());
  if (!category) {
    const base = slugify(item.categoryName);
    let slug = base;
    for (let suffix = 2; usedSlugs.has(slug); suffix += 1) slug = `${base}-${suffix}`;
    usedSlugs.add(slug);
    category = { id: `cat_${crypto.randomUUID()}`, name: item.categoryName, slug, sort_order: nextCategorySort };
    nextCategorySort += 10;
    categoriesByName.set(item.categoryName.toLowerCase(), category);
    summary.categoriesCreated += 1;
    statements.push(
      `INSERT INTO categories (id, user_id, name, slug, sort_order, created_at, updated_at) VALUES (${q(category.id)}, ${q(USER_ID)}, ${q(category.name)}, ${q(category.slug)}, ${category.sort_order}, ${q(now)}, ${q(now)});`,
    );
  }

  const sortOrder = (sortCounters.get(category.id) ?? 0) + 10;
  sortCounters.set(category.id, sortOrder);

  const description = item.description?.trim().slice(0, 1000);
  statements.push(
    `INSERT INTO bookmarks (id, user_id, category_id, title, url, normalized_url, description, favicon_url, sort_order, is_favourite, created_at, updated_at) VALUES (${q(`bm_${crypto.randomUUID()}`)}, ${q(USER_ID)}, ${q(category.id)}, ${q(item.title.slice(0, 500))}, ${q(url)}, ${q(normalizedKey)}, ${description ? q(description) : "NULL"}, ${q(faviconUrlForDomain(domainFromUrl(url)))}, ${sortOrder}, 0, ${q(now)}, ${q(now)});`,
  );
  summary.imported += 1;
}

statements.push(
  `INSERT INTO import_jobs (id, user_id, filename, source, status, total_items, imported_items, skipped_duplicates, created_at, completed_at) VALUES (${q(`job_${crypto.randomUUID()}`)}, ${q(USER_ID)}, ${q(basename(exportFile))}, 'booky', 'completed', ${summary.found}, ${summary.imported}, ${summary.skippedDuplicates}, ${q(now)}, ${q(now)});`,
);

writeFileSync(outFile, statements.join("\n"), "utf8");
console.log(JSON.stringify(summary, null, 2));
console.log("statements:", statements.length, "->", outFile);
