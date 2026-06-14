// Rebuilds the LinkShelf category tree + bookmarks from a recategorised CSV
// export (linkshelf-bookmarks-recategorised.csv). Mirrors the storage model in
// migrations/0001_initial.sql: a flat `categories` table whose name encodes the
// hierarchy as "Top Level / Sub / ...", split for display on the FIRST " / "
// (see src/lib/collections.ts).
//
// It emits a single SQL file that:
//   1. deletes the seed user's existing bookmarks + categories,
//   2. inserts one category row per unique CSV category path (ordered so the 9
//      manual top-levels appear in the agreed order), and
//   3. inserts every kept bookmark.
//
// The Lonely Planet / Thorn Tree rows are excluded defensively even though the
// supplied CSV already has them removed.
//
// Usage:
//   node scripts/migrate-categories-from-csv.mjs <recategorised.csv> <out.sql>
//   wrangler d1 execute linkshelf --remote --file <out.sql>
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const USER_ID = "user_private_seed";

// The 9 manual top-levels, in the exact order they must appear on the
// dashboard. "Most Used" is generated, not stored, so it is NOT listed here.
const TOP_LEVEL_ORDER = [
  "Luxembourg Life & Admin",
  "Work & Data",
  "Travel Tools & Booking",
  "Destinations by Region",
  "Websites, AI & Projects",
  "Photography & Visual Ideas",
  "Health, Fitness & Gear",
  "Personal, Family & Study",
  "Reading, Learning & Reference",
];

const [csvFile, outFile] = process.argv.slice(2);
if (!outFile) {
  console.error("Usage: node scripts/migrate-categories-from-csv.mjs <recategorised.csv> <out.sql>");
  process.exit(1);
}

// ---- small helpers (inlined so the script runs under plain Node) ------------

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

const readText = (file) => {
  const text = readFileSync(file, "utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
};

// slugify mirrors src/lib/categories.ts
function slugify(name) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "category";
}

// normalizeUrl / normalizeUrlKey mirror src/lib/urlNormalize.ts
function normalizeUrl(input) {
  const trimmed = input.trim();
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/" && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  if (url.pathname === "/" && !url.search && !url.hash) return `${url.protocol}//${url.host}`;
  return url.toString();
}
function normalizeUrlKey(input) {
  const url = new URL(normalizeUrl(input));
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.host}${path}${url.search}${url.hash}`;
}
function recoverEmbeddedUrl(input) {
  const match = input.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}
function domainFromUrl(input) {
  try {
    return new URL(normalizeUrl(input)).hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^https?:\/\//, "").split("/")[0] || input;
  }
}
function faviconUrlForDomain(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

// ---- minimal RFC-4180 CSV parser -------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // swallow; handled by the \n branch
    } else {
      field += c;
    }
  }
  // trailing field / row (file may not end with a newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---- read + validate CSV ----------------------------------------------------

const rawRows = parseCsv(readText(csvFile));
const header = rawRows.shift();
const col = Object.fromEntries(header.map((name, idx) => [name.trim(), idx]));
for (const required of ["category", "title", "url", "sort_order", "is_favourite", "created_at", "updated_at"]) {
  if (!(required in col)) {
    console.error(`CSV is missing required column "${required}". Found: ${header.join(", ")}`);
    process.exit(1);
  }
}

const records = rawRows
  .filter((r) => r.some((v) => v.trim().length > 0)) // skip blank lines
  .map((r) => ({
    category: (r[col.category] ?? "").trim(),
    title: (r[col.title] ?? "").trim(),
    url: (r[col.url] ?? "").trim(),
    description: (r[col.description] ?? "").trim(),
    sort_order: Number.parseInt((r[col.sort_order] ?? "0").trim(), 10) || 0,
    is_favourite: /^(1|true|yes)$/i.test((r[col.is_favourite] ?? "").trim()),
    created_at: (r[col.created_at] ?? "").trim(),
    updated_at: (r[col.updated_at] ?? "").trim(),
  }));

// ---- Lonely Planet / Thorn Tree exclusion rule ------------------------------

function isExcluded(rec) {
  const url = rec.url.toLowerCase();
  const title = rec.title.toLowerCase();
  return (
    url.includes("lonelyplanet.com") ||
    title.includes("lonely planet") ||
    title.includes("thorn tree")
  );
}

const summary = { found: records.length, excluded: 0, imported: 0, skippedInvalid: 0, skippedDuplicate: 0 };
const warnings = [];

// ---- build category list ----------------------------------------------------

function topLevelOf(path) {
  const idx = path.indexOf(" / ");
  return idx === -1 ? path : path.slice(0, idx);
}

// First-seen order of unique category paths.
const pathFirstSeen = new Map();
let seenIndex = 0;
for (const rec of records) {
  if (isExcluded(rec)) continue;
  if (!rec.category) {
    warnings.push(`Row has empty category: ${rec.title.slice(0, 80)}`);
    continue;
  }
  if (!pathFirstSeen.has(rec.category)) pathFirstSeen.set(rec.category, seenIndex++);
}

// Order paths: primary by the 9 top-levels (doc order), then by first-seen.
const topRank = new Map(TOP_LEVEL_ORDER.map((name, idx) => [name, idx]));
const orderedPaths = [...pathFirstSeen.keys()].sort((a, b) => {
  const ra = topRank.has(topLevelOf(a)) ? topRank.get(topLevelOf(a)) : 999;
  const rb = topRank.has(topLevelOf(b)) ? topRank.get(topLevelOf(b)) : 999;
  if (ra !== rb) return ra - rb;
  return pathFirstSeen.get(a) - pathFirstSeen.get(b);
});

// Warn about any path whose top-level isn't one of the 9, or that has no " / ".
for (const path of orderedPaths) {
  const top = topLevelOf(path);
  if (!topRank.has(top)) warnings.push(`Path outside the 9 top-levels: "${path}"`);
  if (!path.includes(" / ")) warnings.push(`Path has no sub-category (renders ungrouped): "${path}"`);
}

const categoryByPath = new Map();
const usedSlugs = new Set(["uncategorised"]); // reserved for the kept bucket
const now = new Date().toISOString();
const statements = [];

// 1) wipe existing data for the seed user. Keep the fixed "Uncategorised"
// bucket (cat_uncategorised): db.ts/deleteCategory reparent bookmarks to it and
// the bookmarks FK references it. It stays empty + hidden on the dashboard.
const UNCATEGORISED_ID = "cat_uncategorised";
statements.push(`DELETE FROM bookmarks WHERE user_id = ${q(USER_ID)};`);
statements.push(`DELETE FROM categories WHERE user_id = ${q(USER_ID)} AND id != ${q(UNCATEGORISED_ID)};`);
statements.push(
  `INSERT OR IGNORE INTO categories (id, user_id, name, slug, sort_order, created_at, updated_at) VALUES (${q(UNCATEGORISED_ID)}, ${q(USER_ID)}, 'Uncategorised', 'uncategorised', 0, ${q(now)}, ${q(now)});`,
);

// 2) insert categories
orderedPaths.forEach((path, index) => {
  const base = slugify(path);
  let slug = base;
  for (let suffix = 2; usedSlugs.has(slug); suffix += 1) slug = `${base}-${suffix}`;
  usedSlugs.add(slug);
  const id = `cat_${randomUUID()}`;
  const sortOrder = (index + 1) * 10;
  categoryByPath.set(path, id);
  statements.push(
    `INSERT INTO categories (id, user_id, name, slug, sort_order, created_at, updated_at) VALUES (${q(id)}, ${q(USER_ID)}, ${q(path)}, ${q(slug)}, ${sortOrder}, ${q(now)}, ${q(now)});`,
  );
});

// 3) insert bookmarks
const seenUrlKeys = new Set();
for (const rec of records) {
  if (isExcluded(rec)) {
    summary.excluded += 1;
    continue;
  }
  if (!rec.category || !categoryByPath.has(rec.category)) continue;

  let url;
  let key;
  try {
    let usable = rec.url;
    try {
      normalizeUrl(usable);
    } catch {
      usable = recoverEmbeddedUrl(rec.url);
      if (!usable) throw new Error("invalid");
    }
    url = normalizeUrl(usable);
    key = normalizeUrlKey(usable);
  } catch {
    summary.skippedInvalid += 1;
    warnings.push(`Skipped invalid URL: ${rec.url.slice(0, 100)}`);
    continue;
  }

  if (seenUrlKeys.has(key)) {
    summary.skippedDuplicate += 1;
    warnings.push(`Skipped duplicate URL: ${rec.url.slice(0, 100)}`);
    continue;
  }
  seenUrlKeys.add(key);

  const categoryId = categoryByPath.get(rec.category);
  const description = rec.description ? rec.description.slice(0, 1000) : null;
  const createdAt = rec.created_at || now;
  const updatedAt = rec.updated_at || now;
  statements.push(
    `INSERT INTO bookmarks (id, user_id, category_id, title, url, normalized_url, description, favicon_url, sort_order, is_favourite, created_at, updated_at) VALUES (${q(`bm_${randomUUID()}`)}, ${q(USER_ID)}, ${q(categoryId)}, ${q(rec.title.slice(0, 500))}, ${q(url)}, ${q(key)}, ${description ? q(description) : "NULL"}, ${q(faviconUrlForDomain(domainFromUrl(url)))}, ${rec.sort_order}, ${rec.is_favourite ? 1 : 0}, ${q(createdAt)}, ${q(updatedAt)});`,
  );
  summary.imported += 1;
}

// 4) record an import job for the history
statements.push(
  `INSERT INTO import_jobs (id, user_id, filename, source, status, total_items, imported_items, skipped_duplicates, created_at, completed_at) VALUES (${q(`job_${randomUUID()}`)}, ${q(USER_ID)}, ${q(csvFile.split(/[\\/]/).pop())}, 'csv-recategorise', 'completed', ${summary.found}, ${summary.imported}, ${summary.skippedDuplicate}, ${q(now)}, ${q(now)});`,
);

writeFileSync(outFile, statements.join("\n") + "\n", "utf8");

// ---- report -----------------------------------------------------------------

const countByTop = new Map();
const countByPath = new Map();
for (const rec of records) {
  if (isExcluded(rec) || !categoryByPath.has(rec.category)) continue;
  countByPath.set(rec.category, (countByPath.get(rec.category) ?? 0) + 1);
  const top = topLevelOf(rec.category);
  countByTop.set(top, (countByTop.get(top) ?? 0) + 1);
}

console.log("=== Summary ===");
console.log(JSON.stringify(summary, null, 2));
console.log(`Unique category paths: ${orderedPaths.length}`);
console.log(`Top-level categories: ${countByTop.size}`);
console.log("\n=== Top-level counts (doc order) ===");
for (const top of TOP_LEVEL_ORDER) {
  console.log(`${String(countByTop.get(top) ?? 0).padStart(4)}  ${top}`);
}
const strayTops = [...countByTop.keys()].filter((t) => !topRank.has(t));
if (strayTops.length) console.log("\nSTRAY top-levels (not in the 9):", strayTops);

if (warnings.length) {
  console.log(`\n=== Warnings (${warnings.length}) ===`);
  for (const w of warnings.slice(0, 30)) console.log(`- ${w}`);
  if (warnings.length > 30) console.log(`... and ${warnings.length - 30} more`);
}
console.log(`\nWrote ${statements.length} statements -> ${outFile}`);
