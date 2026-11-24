import "./styles.css";
import { h } from "./dom";
import { MODELS } from "./model/catalog";
import { projectorView } from "./projector/projectorView";
import { architectureView } from "./views/architectureView";

const ROUTES = [
  { hash: "#/atual", label: "Arquitetura atual", view: () => architectureView(MODELS.atual) },
  { hash: "#/ia", label: "Arquitetura de IA", view: () => architectureView(MODELS.ia) },
  { hash: "#/projetor", label: "Projetor de embeddings", view: projectorView },
] as const;

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("#app ausente no index.html");

const nav = h("nav", { class: "nav", "aria-label": "Visões" },
  ...ROUTES.map((r) => h("a", { href: r.hash }, r.label)),
);
const main = h("main", { class: "main" });

app.append(
  h("header", { class: "top" },
    h("div", { class: "brand" },
      h("span", { class: "mark", "aria-hidden": "true" }),
      h("div", {}, h("h1", {}, "SUS Cidadão · Arquitetura"), h("p", {}, "DESAFIO-2 · fonte única em model/*.json")),
    ),
    nav,
  ),
  main,
);

function render(): void {
  const route = ROUTES.find((r) => r.hash === location.hash) ?? ROUTES[0];
  nav.querySelectorAll("a").forEach((a) => {
    a.toggleAttribute("aria-current", a.getAttribute("href") === route.hash);
  });
  main.replaceChildren(route.view());
  document.title = `${route.label} · SUS Cidadão`;
}

window.addEventListener("hashchange", render);
render();
