const THEME_KEY = "linkshelf-theme";

export type Theme = "light" | "dark";

const LABELS: Record<Theme, string> = {
  dark: "Dark theme. Switch to light.",
  light: "Light theme. Switch to dark.",
};

/** Default is dark (the premium vault look) unless the user chose light. */
export function storedTheme(): Theme {
  try {
    if (localStorage.getItem(THEME_KEY) === "light") return "light";
  } catch {
    // storage unavailable
  }
  return "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
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
  const next: Theme = storedTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

export function initTheme(): void {
  applyTheme(storedTheme());
  for (const toggle of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
    toggle.addEventListener("click", () => cycleTheme());
  }
}
