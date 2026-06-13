import { $, $$ } from "./dom";

/**
 * Mobile category drawer: the rail aside slides in over the content. Position
 * and backdrop are driven with inline styles so nothing in the bundled CSS
 * cascade can override them; CSS still handles the slide transition.
 */
export function initDrawer(): void {
  const aside = $("[data-rail-aside]");
  const backdrop = $("[data-rail-backdrop]");
  if (!aside) return;

  const open = () => {
    aside.style.transform = "translateX(0)";
    aside.classList.add("is-open");
    if (backdrop) {
      backdrop.style.opacity = "1";
      backdrop.style.pointerEvents = "auto";
    }
  };
  const close = () => {
    aside.style.transform = ""; // revert to the CSS base (off-canvas / static)
    aside.classList.remove("is-open");
    if (backdrop) {
      backdrop.style.opacity = "";
      backdrop.style.pointerEvents = "";
    }
  };

  for (const button of $$("[data-rail-toggle]")) button.addEventListener("click", open);
  for (const button of $$("[data-rail-close]")) button.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  // Tapping a category navigates and should dismiss the drawer on mobile.
  aside.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest(".rail-link")) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}
