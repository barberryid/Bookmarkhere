import { $ } from "./dom";

const DENSITY_KEY = "linkshelf-density";

type Density = "grid" | "compact";

function stored(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "grid";
  } catch {
    return "grid";
  }
}

function apply(density: Density): void {
  const main = document.querySelector<HTMLElement>("main");
  if (main) main.dataset.density = density;
  for (const toggle of document.querySelectorAll<HTMLElement>("[data-density-toggle]")) {
    toggle.setAttribute("aria-pressed", String(density === "compact"));
    toggle.title = density === "compact" ? "Compact list (click for grid)" : "Grid (click for compact list)";
    $(".density-icon-grid", toggle)?.classList.toggle("hidden", density === "compact");
    $(".density-icon-compact", toggle)?.classList.toggle("hidden", density !== "compact");
  }
}

export function toggleDensity(): void {
  const next: Density = stored() === "compact" ? "grid" : "compact";
  try {
    localStorage.setItem(DENSITY_KEY, next);
  } catch {
    // storage unavailable
  }
  apply(next);
}

export function initDensity(): void {
  apply(stored());
  for (const toggle of document.querySelectorAll<HTMLElement>("[data-density-toggle]")) {
    toggle.addEventListener("click", () => toggleDensity());
  }
}
