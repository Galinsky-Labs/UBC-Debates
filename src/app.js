import { ROUTES, resolveRoute, loadView } from "./contracts.js";
import { createEngineClient } from "./engine-client.js";
import { CONFIG } from "./config.js";

const client = createEngineClient({ origin: CONFIG.engineOrigin, tenantId: CONFIG.tenantId });
const nav = document.querySelector("[data-navigation]");
const heading = document.querySelector("[data-title]");
const message = document.querySelector("[data-message]");
const status = document.querySelector("[data-status]");
const content = document.querySelector("[data-content]");
let navigationVersion = 0;

document.querySelector(".skip").addEventListener("click", event => { event.preventDefault(); document.querySelector("main").focus(); });
for (const route of ROUTES) {
  const link = document.createElement("a");
  link.href = route.hash; link.textContent = route.label; link.dataset.route = route.id;
  nav.append(link);
}
function formatTime(ms) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
/** Text nodes only; links come from the validated view model (fixed hashes or the configured engine origin). */
function render(sections) {
  content.replaceChildren();
  for (const section of sections) {
    const wrapper = document.createElement("section");
    const h = document.createElement("h2"); h.textContent = section.heading; wrapper.append(h);
    const list = document.createElement(section.transcript ? "ol" : "ul");
    for (const item of section.items) {
      const li = document.createElement("li");
      if (section.transcript) { const t = document.createElement("span"); t.className = "time"; t.textContent = formatTime(item.time ?? 0); li.append(t); }
      if (item.href) {
        const a = document.createElement("a"); a.href = item.href; a.textContent = item.text;
        if (item.external) a.setAttribute("rel", "noopener noreferrer");
        li.append(a);
      } else { const span = document.createElement("span"); span.textContent = item.text; li.append(span); }
      if (item.detail) { const d = document.createElement("p"); d.className = "detail"; d.textContent = item.detail; li.append(d); }
      list.append(li);
    }
    wrapper.append(list); content.append(wrapper);
  }
}
async function navigate(moveFocus = false) {
  const version = ++navigationVersion;
  const resolved = resolveRoute(window.location.hash);
  for (const link of nav.querySelectorAll("a")) {
    const current = resolved && (link.dataset.route === resolved.route.id || (resolved.route.id === "debate" && link.dataset.route === "debates"));
    if (current) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  }
  if (!resolved) {
    heading.textContent = "Page not found"; message.textContent = "Choose a page from the navigation to continue."; status.textContent = "Unavailable page";
    content.replaceChildren(); document.title = "Page not found | UBC Debates";
    if (moveFocus) heading.focus();
    return;
  }
  status.textContent = "Loading…";
  const model = await loadView(resolved, client);
  if (version !== navigationVersion) return;
  heading.textContent = model.title; message.textContent = model.message; status.textContent = model.status;
  render(model.sections);
  document.title = `${model.title} | UBC Debates`;
  if (moveFocus) heading.focus();
}
window.addEventListener("hashchange", () => { void navigate(true); });
void navigate();
