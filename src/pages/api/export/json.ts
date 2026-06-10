import type { APIRoute } from "astro";
import { bookmarks, categories, seedUser } from "@lib/mockData";

export const GET: APIRoute = async () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: "LinkShelf static prototype",
    user: seedUser,
    categories,
    bookmarks,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="linkshelf-bookmarks.json"',
    },
  });
};
