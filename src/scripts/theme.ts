const THEME_KEY = "linkshelf-theme";

export type Theme = "light" | "dark" | "system";

const ORDER: Theme[] = ["light", "dark", "system"];

const LABELS: Record<Theme, string> = {
  light: "Theme: light. Switch to dark.",
  dark: "Theme: dark. Switch to system.",
  system: "Theme: system. Switch to light.",
};

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // storage unavailable
  }
  return "system";
}

export function applyTheme(theme: Theme): void {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = theme;
  for (const toggle of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
    toggle.setAttribute("aria-label", LABELS[theme]);
    toggle.title = LABELS[theme];
  }
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage unavailable
  }
  applyTheme(theme);
}

export function cycleTheme(): Theme {
  const current = storedTheme();
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  setTheme(next);
  return next;
}

export function initTheme(): void {
  applyTheme(storedTheme());

  for (const toggle of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
    toggle.addEventListener("click", () => cycleTheme());
  }

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (storedTheme() === "system") applyTheme("system");
    });
}
