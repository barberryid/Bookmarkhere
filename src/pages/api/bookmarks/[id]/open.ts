import type { APIRoute } from "astro";
import { apiError, json } from "@lib/api";
import { getPrivateUserId } from "@lib/auth";
import { recordOpen } from "@lib/bookmarks";
import { getDb } from "@lib/db";

export const prerender = false;

// Fired (via sendBeacon/fetch keepalive) when a bookmark link is opened from
// the dashboard. Feeds the generated "Most Used" section. Best-effort: a
// failure here must never block the navigation, so we just 204 on success.
export const POST: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) return apiError("Bookmark id is required.");

  const db = getDb();
  const userId = getPrivateUserId();

  const recorded = await recordOpen(db, userId, id);
  if (!recorded) return apiError("Bookmark not found.", 404);
  return json({ ok: true }, 202);
};
