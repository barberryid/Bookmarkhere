import type { APIRoute } from "astro";
import { bookmarks, categories } from "@lib/mockData";

const header = [
  "category",
  "title",
  "url",
  "description",
  "sort_order",
  "is_favourite",
  "created_at",
  "updated_at",
];

export const GET: APIRoute = async () => {
  const rows = bookmarks.map((bookmark) => {
    const category = categories.find((item) => item.id === bookmark.categoryId);

    return [
      category?.name ?? "Uncategorised",
      bookmark.title,
      bookmark.url,
      bookmark.description ?? "",
      String(bookmark.sortOrder),
      bookmark.isFavourite ? "true" : "false",
      bookmark.createdAt,
      bookmark.updatedAt,
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="linkshelf-bookmarks.csv"',
    },
  });
};

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
