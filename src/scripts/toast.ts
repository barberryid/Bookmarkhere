type ToastKind = "info" | "success" | "error";

type ToastOptions = {
  kind?: ToastKind;
  /** Milliseconds before auto-dismiss. */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

const MAX_TOASTS = 3;

export function toast(message: string, options: ToastOptions = {}): () => void {
  const region = document.getElementById("toast-region");
  if (!region) return () => {};

  const kind = options.kind ?? "info";
  const duration = options.duration ?? (kind === "error" ? 7000 : 5000);

  while (region.children.length >= MAX_TOASTS) {
    region.firstElementChild?.remove();
  }

  const el = document.createElement("div");
  el.className =
    "pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-pop " +
    (kind === "error"
      ? "border-danger/40 bg-danger-soft text-danger"
      : "border-edge bg-surface text-ink");
  el.setAttribute("role", kind === "error" ? "alert" : "status");

  const text = document.createElement("span");
  text.className = "min-w-0";
  text.textContent = message;
  el.append(text);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.remove();
  };

  if (options.action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "focus-ring shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-accent hover:bg-accent-soft";
    button.textContent = options.action.label;
    button.addEventListener("click", () => {
      options.action?.onClick();
      close();
    });
    el.append(button);
  }

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className =
    "focus-ring grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-ink";
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.textContent = "✕";
  dismiss.addEventListener("click", close);
  el.append(dismiss);

  region.append(el);

  // Auto-dismiss, paused while hovered.
  let remaining = duration;
  let startedAt = Date.now();
  let timer = window.setTimeout(close, remaining);
  el.addEventListener("mouseenter", () => {
    window.clearTimeout(timer);
    remaining -= Date.now() - startedAt;
  });
  el.addEventListener("mouseleave", () => {
    startedAt = Date.now();
    timer = window.setTimeout(close, Math.max(remaining, 500));
  });

  return close;
}
