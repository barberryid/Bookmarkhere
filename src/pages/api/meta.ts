import type { APIRoute } from "astro";
import { json } from "@lib/api";
import { isValidHttpUrl, normalizeUrl } from "@lib/urlNormalize";

export const prerender = false;

const FETCH_TIMEOUT_MS = 3000;
const MAX_BYTES = 512 * 1024; // cap how much HTML we read

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

/**
 * Server-side title fetch for the add-bookmark autofill. Best-effort: any
 * failure returns { title: null } so the client falls back to manual entry.
 */
export const GET: APIRoute = async ({ url }) => {
  const target = url.searchParams.get("url")?.trim();
  if (!target || !isValidHttpUrl(target)) return json({ title: null });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(normalizeUrl(target), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LinkShelf/1.0; +bookmark-title-fetch)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html") || !response.body) {
      return json({ title: null });
    }

    // Read at most MAX_BYTES; the <title> is almost always near the top.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/title>/i.test(html)) break;
    }
    await reader.cancel().catch(() => {});

    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = match ? decodeEntities(match[1].replace(/\s+/g, " ").trim()) : "";
    return json({ title: title || null });
  } catch {
    return json({ title: null });
  } finally {
    clearTimeout(timer);
  }
};
