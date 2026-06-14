/**
 * Best-effort open tracking for the generated "Most Used" section. When a
 * bookmark's link is activated we beacon its id to the server, which bumps the
 * open counters. Uses sendBeacon so the request survives the page unloading as
 * the new tab opens; never blocks or affects the navigation itself.
 */
function recordOpen(id: string): void {
  if (!id) return;
  const url = `/api/bookmarks/${encodeURIComponent(id)}/open`;
  try {
    if (navigator.sendBeacon?.(url)) return;
  } catch {
    // fall through to fetch
  }
  // Fallback for browsers without sendBeacon; keepalive lets it outlive unload.
  fetch(url, { method: "POST", keepalive: true }).catch(() => {});
}

export function initTracking(): void {
  // Capture primary clicks and middle-clicks (open-in-new-tab) on card links.
  const handler = (event: Event): void => {
    const mouse = event as MouseEvent;
    if (mouse.button !== undefined && mouse.button > 1) return; // ignore right-click
    const link = (event.target as HTMLElement | null)?.closest?.("[data-card-link]");
    if (!link) return;
    const card = link.closest<HTMLElement>("[data-bookmark-card]");
    const id = card?.dataset.id;
    if (id) recordOpen(id);
  };
  document.addEventListener("click", handler);
  document.addEventListener("auxclick", handler);
}
