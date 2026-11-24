import { renderDiagram } from "../diagram/render";
import { neighborsOf } from "../diagram/layout";
import { h } from "../dom";
import { sourceUrl } from "../model/catalog";
import type { ArchNode, ArchitectureModel, Metric } from "../model/types";
import { KIND_LABEL, SEVERITY_LABEL, STATUS_LABEL } from "./labels";

function metricRow(m: Metric): HTMLElement {
  const verdict = m.pass === true ? "Aprovado" : m.pass === false ? "Reprovado" : "Não medido";
  const tone = m.pass === true ? "pass" : m.pass === false ? "fail" : "pending";
  return h("tr", { title: m.note },
    h("td", {}, m.label),
    h("td", { class: "num" }, m.value),
    h("td", { class: "num muted" }, m.target),
    h("td", {}, h("span", { class: `verdict ${tone}` }, verdict)),
  );
}

function details(model: ArchitectureModel, node: ArchNode): HTMLElement {
  const commit = model.sources.find((src) => src.repo === node.repo)?.commit;
  const link = node.repo && commit
    ? h("a", { href: sourceUrl(node.repo, commit, node.path), target: "_blank", rel: "noopener" },
        `${node.repo}${node.path ? ` / ${node.path}` : ""}`)
    : null;
  return h("div", { class: "details" },
    h("div", { class: "chips" },
      h("span", { class: `chip kind-${node.kind}` }, KIND_LABEL[node.kind]),
      h("span", { class: `chip status-${node.status}` }, STATUS_LABEL[node.status]),
    ),
    h("h3", {}, node.label),
    h("p", {}, node.description),
    link ? h("p", { class: "path" }, link) : null,
    node.metrics?.length
      ? h("table", { class: "metrics" },
          h("thead", {}, h("tr", {},
            h("th", {}, "Métrica"), h("th", { class: "num" }, "Valor"),
            h("th", { class: "num" }, "Meta"), h("th", {}, "Resultado"))),
          h("tbody", {}, ...node.metrics.map(metricRow)))
      : null,
  );
}

function highlight(svg: SVGSVGElement, model: ArchitectureModel, id: string | null): void {
  const near = id ? neighborsOf(model, id) : null;
  svg.classList.toggle("focused", Boolean(id));
  svg.querySelectorAll<SVGGElement>(".node").forEach((g) => {
    const nodeId = g.dataset["id"] ?? "";
    g.classList.toggle("selected", nodeId === id);
    g.classList.toggle("near", Boolean(near?.has(nodeId)));
  });
  svg.querySelectorAll<SVGElement>(".edge, .edge-label").forEach((g) => {
    const on = Boolean(id) && (g.dataset["from"] === id || g.dataset["to"] === id);
    g.classList.toggle("near", on);
  });
}

export function architectureView(model: ArchitectureModel): HTMLElement {
  const drawer = h("aside", { class: "drawer", "aria-live": "polite", hidden: true });
  let selected: string | null = null;

  const select = (id: string | null): void => {
    selected = selected === id ? null : id;
    highlight(svg, model, selected);
    const node = model.nodes.find((n) => n.id === selected);
    drawer.hidden = !node;
    if (!node) return;
    const close = h("button", { type: "button", class: "close", "aria-label": "Fechar detalhes" }, "×");
    close.addEventListener("click", () => select(null));
    drawer.replaceChildren(close, details(model, node));
  };
  const svg = renderDiagram(model, select);
  const sources = model.sources.map((src) =>
    h("a", { href: sourceUrl(src.repo, src.commit), target: "_blank", rel: "noopener", class: "source" },
      `${src.repo}@${src.commit}`),
  );
  const fails = model.nodes.flatMap((n) => n.metrics ?? []).filter((m) => m.pass === false).length;

  const root = h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", {},
        h("h2", {}, model.title),
        h("p", { class: "lede" }, model.subtitle),
      ),
      h("div", { class: "meta" },
        h("span", {}, `Estado em ${model.asOf.split("-").reverse().join("/")}`),
        h("span", { class: "sources" }, ...sources),
      ),
    ),
    h("div", { class: "stats" },
      h("div", { class: "stat" }, h("strong", {}, String(model.nodes.length)), h("span", {}, "blocos")),
      h("div", { class: "stat" }, h("strong", {}, String(model.edges.length)), h("span", {}, "ligações")),
      h("div", { class: "stat" },
        h("strong", {}, String(model.nodes.filter((n) => n.status !== "active").length)),
        h("span", {}, "experimentais ou planejados")),
      fails ? h("div", { class: "stat warn" }, h("strong", {}, String(fails)), h("span", {}, "métricas reprovadas")) : null,
    ),
    h("div", { class: "legend" },
      h("span", { class: "legend-item status-active" }, "Em uso"),
      h("span", { class: "legend-item status-experimental" }, "Experimental"),
      h("span", { class: "legend-item status-planned" }, "Planejado"),
      h("span", { class: "legend-item dashed" }, "Ligação parcial ou planejada"),
      h("span", { class: "legend-item fail" }, "Tem métrica reprovada"),
      h("span", { class: "hint" }, "Clique num bloco para ver código, descrição e métricas."),
    ),
    h("div", { class: "canvas", tabindex: 0, "aria-label": "Diagrama; em telas pequenas, role para os lados" }, svg),
    drawer,
    h("h3", { class: "section-title" }, "Achados do arquiteto"),
    h("ul", { class: "findings" },
      ...model.findings.map((f) =>
        h("li", { class: `finding sev-${f.severity}` },
          h("span", { class: "sev" }, SEVERITY_LABEL[f.severity]),
          h("div", {}, h("strong", {}, f.title), h("p", {}, f.text)),
        ),
      ),
    ),
  );
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selected) select(null);
  });
  return root;
}
