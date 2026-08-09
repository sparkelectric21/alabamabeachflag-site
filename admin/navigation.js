const nav = document.querySelector(".admin-nav");
const toggle = nav?.querySelector(".nav-toggle");
const links = nav?.querySelector(".nav-links");

const hasHistoricalDataLink = links && [...links.querySelectorAll("a")]
  .some((link) => link.textContent.trim() === "Historical Data");

if (links && !hasHistoricalDataLink) {
  const historical = document.createElement("a");
  historical.href = `${location.pathname.includes("/admin/") && !location.pathname.endsWith("/admin/") ? "../" : ""}historical-data/`;
  historical.textContent = "Historical Data";
  links.insertBefore(historical, links.querySelector("button"));
}

if (nav && toggle && links) {
  const close = ({ restoreFocus = false } = {}) => {
    nav.dataset.open = "false";
    toggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) toggle.focus();
  };

  toggle.addEventListener("click", () => {
    const opening = nav.dataset.open !== "true";
    nav.dataset.open = String(opening);
    toggle.setAttribute("aria-expanded", String(opening));
    if (opening) links.querySelector("[aria-current='page']")?.focus();
  });

  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.dataset.open === "true") close({ restoreFocus: true });
  });
  window.matchMedia("(min-width: 981px)").addEventListener("change", ({ matches }) => {
    if (matches) close();
  });
}
