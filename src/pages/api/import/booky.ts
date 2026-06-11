import type { APIRoute } from "astro";
import { apiError, json } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { ensureCategory } from "@lib/categories";
import { getDb, newId, nowIso } from "@lib/db";
import { parseBookyExport } from "@lib/importers/booky";
import type { Category, ImportSummary } from "@lib/types";
import { domainFromUrl, faviconUrlForDomain, normalizeUrl, normalizeUrlKey, recoverEmbeddedUrl } from "@lib/urlNormalize";

export const prerender = false;

const INSERT_BATCH_SIZE = 50;

export const POST: APIRoute = async ({ locals, request }) => {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return apiError("Upload the export file as multipart form data under the name \"file\".");
  }

  const raw = await file.text();
  const parsed = parseBookyExport(raw);

  const db = getDb();
  const userId = getPrivateUserId();
  const jobId = newId("job");

  await db
    .prepare(
      "INSERT INTO import_jobs (id, user_id, filename, source, status, total_items, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(jobId, userId, file.name || "booky-export", parsed.source, "running", parsed.items.length, nowIso())
    .run();

  const summary: ImportSummary = {
    found: parsed.items.length,
    imported: 0,
    skippedDuplicates: 0,
    categoriesCreated: 0,
    errors: [...parsed.errors],
  };

  try {
    // Existing normalized URLs for duplicate detection (also catches
    // duplicates within the import file itself).
    const { results: urlRows } = await db
      .prepare("SELECT normalized_url FROM bookmarks WHERE user_id = ?1")
      .bind(userId)
      .all<{ normalized_url: string }>();
    const seenUrls = new Set(urlRows.map((row) => row.normalized_url));

    const categoriesByName = new Map<string, Category>();
    const sortCounters = new Map<string, number>();
    const statements: D1PreparedStatement[] = [];

    const insertStmt = db.prepare(
      `INSERT INTO bookmarks (id, user_id, category_id, title, url, normalized_url, description, favicon_url, sort_order, is_favourite, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    );

    for (const item of parsed.items) {
      let url: string;
      let normalizedKey: string;
      try {
        const usable = (() => {
          try {
            normalizeUrl(item.url);
            return item.url;
          } catch {
            const recovered = recoverEmbeddedUrl(item.url);
            if (!recovered) throw new Error("invalid");
            return recovered;
          }
        })();
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
        const ensured = await ensureCategory(db, userId, item.categoryName);
        category = ensured.category;
        categoriesByName.set(item.categoryName.toLowerCase(), category);
        if (ensured.created) summary.categoriesCreated += 1;
      }

      if (!sortCounters.has(category.id)) {
        const row = await db
          .prepare(
            "SELECT MAX(sort_order) AS max_sort FROM bookmarks WHERE user_id = ?1 AND category_id = ?2",
          )
          .bind(userId, category.id)
          .first<{ max_sort: number | null }>();
        sortCounters.set(category.id, row?.max_sort ?? 0);
      }
      const sortOrder = (sortCounters.get(category.id) ?? 0) + 10;
      sortCounters.set(category.id, sortOrder);

      const now = nowIso();
      statements.push(
        insertStmt.bind(
          newId("bm"),
          userId,
          category.id,
          item.title.slice(0, 500),
          url,
          normalizedKey,
          item.description?.trim() || null,
          faviconUrlForDomain(domainFromUrl(url)),
          sortOrder,
          0,
          now,
          now,
        ),
      );
      summary.imported += 1;
    }

    for (let i = 0; i < statements.length; i += INSERT_BATCH_SIZE) {
      await db.batch(statements.slice(i, i + INSERT_BATCH_SIZE));
    }

    await db
      .prepare(
        "UPDATE import_jobs SET status = ?1, imported_items = ?2, skipped_duplicates = ?3, completed_at = ?4 WHERE id = ?5",
      )
      .bind("completed", summary.imported, summary.skippedDuplicates, nowIso(), jobId)
      .run();

    return json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    await db
      .prepare("UPDATE import_jobs SET status = ?1, error_message = ?2, completed_at = ?3 WHERE id = ?4")
      .bind("failed", message, nowIso(), jobId)
      .run();
    return apiError(`Import failed: ${message}`, 500);
  }
};
