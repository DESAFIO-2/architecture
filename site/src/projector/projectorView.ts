import { h } from "../dom";
import { sourceUrl } from "../model/catalog";
import { groupsOf, matches, seriesByGroup } from "./traces";
import type { AgentProjection, ProjectorIndex, ProjectorPoint } from "./types";

const DATA_DIR = "./data/projector";

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${DATA_DIR}/${file}`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface State {
  data: AgentProjection;
  datasets: Set<string>;
  query: string;
  selected: number | null;
}

function pointCard(state: State, onPick: (i: number) => void): HTMLElement {
  const { data, selected } = state;
  const point = selected === null ? undefined : data.points[selected];
  if (!point) {
    return h("div", { class: "details empty" },
      h("p", {}, "Clique num ponto para ler o texto e ver os 5 vizinhos mais próximos no espaço original de 1.024 dimensões."),
      h("p", { class: "muted" }, "A posição 3D é uma projeção (PCA). A vizinhança é calculada antes da projeção, por cosseno."),
    );
  }
  const neighbor = (i: number): HTMLElement | null => {
    const n = data.points[i];
    if (!n) return null;
    const same = n.group === point.group;
    return h("li", {},
      h("button", { type: "button", class: "neighbor" },
        h("span", { class: `chip ${same ? "status-active" : "status-planned"}` }, n.group),
        h("span", {}, n.text)),
    );
  };
  const list = h("ol", { class: "neighbors" }, ...point.neighbors.map(neighbor));
  list.querySelectorAll("button").forEach((btn, k) => {
    btn.addEventListener("click", () => onPick(point.neighbors[k] ?? 0));
  });
  const crossGroup = point.neighbors.filter((i) => data.points[i]?.group !== point.group).length;
  return h("div", { class: "details" },
    h("div", { class: "chips" },
      h("span", { class: "chip status-active" }, point.group),
      h("span", { class: "chip kind-store" }, point.dataset),
    ),
    h("h3", {}, point.label || point.id),
    h("p", { class: "quote" }, point.text),
    h("p", { class: "muted" }, point.id),
    h("h4", {}, "Vizinhos mais próximos"),
    crossGroup
      ? h("p", { class: "verdict-line" }, `${crossGroup} de ${point.neighbors.length} vizinhos são de outro grupo.`)
      : null,
    list,
  );
}

function plotData(state: State, groups: string[]): object[] {
  const { data, datasets, query, selected } = state;
  const traces: object[] = seriesByGroup(data.points, datasets, groups).map((series) => {
    const pts = series.indices.map((i) => data.points[i] as ProjectorPoint);
    const dim = Boolean(query.trim());
    return {
      type: "scatter3d",
      mode: "markers",
      name: `${series.group} (${pts.length})`,
      x: pts.map((p) => p.x),
      y: pts.map((p) => p.y),
      z: pts.map((p) => p.z),
      customdata: series.indices,
      text: pts.map((p) => `${p.label ? `<b>${escapeHtml(p.label)}</b><br>` : ""}${escapeHtml(p.text.slice(0, 120))}`),
      hovertemplate: "%{text}<extra></extra>",
      marker: { size: pts.length > 1000 ? 2.6 : 4.5, color: series.color, opacity: dim ? 0.18 : 0.82 },
    };
  });
  const found = query.trim() ? data.points.flatMap((p, i) => (datasets.has(p.dataset) && matches(p, query) ? [i] : [])) : [];
  if (found.length) traces.push(highlightTrace(data, found, `busca (${found.length})`, cssVar("--accent")));
  if (selected !== null) {
    const sel = data.points[selected];
    if (sel) traces.push(highlightTrace(data, [selected, ...sel.neighbors], "selecionado e vizinhos", cssVar("--ink")));
  }
  return traces;
}

function highlightTrace(data: AgentProjection, indices: number[], name: string, color: string): object {
  const pts = indices.map((i) => data.points[i] as ProjectorPoint);
  return {
    type: "scatter3d", mode: "markers", name,
    x: pts.map((p) => p.x), y: pts.map((p) => p.y), z: pts.map((p) => p.z),
    customdata: indices,
    text: pts.map((p) => escapeHtml(p.text.slice(0, 120))),
    hovertemplate: "%{text}<extra></extra>",
    marker: { size: 7, color, symbol: "diamond", line: { width: 1, color: cssVar("--surface") } },
  };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function plotLayout(variance: [number, number, number]): object {
  const ink = cssVar("--muted");
  const grid = cssVar("--line");
  const axis = (title: string) => ({
    title: { text: title, font: { size: 11, color: ink } },
    gridcolor: grid, zerolinecolor: grid, showbackground: false,
    tickfont: { size: 9, color: ink },
  });
  const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: true,
    legend: { orientation: "h", y: -0.02, font: { size: 11, color: cssVar("--ink") } },
    scene: {
      xaxis: axis(`PC1 · ${pct(variance[0])}`),
      yaxis: axis(`PC2 · ${pct(variance[1])}`),
      zaxis: axis(`PC3 · ${pct(variance[2])}`),
      camera: { eye: { x: 1.5, y: 1.5, z: 0.9 } },
    },
    uirevision: "keep-camera",
  };
}

async function mountAgent(stage: HTMLElement, file: string): Promise<void> {
  stage.replaceChildren(h("p", { class: "muted pad" }, "Carregando a projeção…"));
  const [Plotly, data] = await Promise.all([
    import("plotly.js-dist-min").then((m) => m.default),
    fetchJson<AgentProjection>(file),
  ]);
  const groups = groupsOf(data.points);
  const datasetIds = data.source.datasets.map((d) => d.id);
  const state: State = { data, datasets: new Set(datasetIds), query: "", selected: null };

  const plot = h("div", { class: "plot", role: "img", "aria-label": `Projeção 3D de ${data.agent.label}` });
  const panel = h("aside", { class: "panel", "aria-live": "polite" });
  const search = h("input", { type: "search", placeholder: "Buscar texto (ex.: insulina, SISREG)", "aria-label": "Buscar texto" });
  const toggles = h("div", { class: "toggles" },
    ...data.source.datasets.map((d) => {
      const count = data.points.filter((p) => p.dataset === d.id).length;
      const box = h("input", { type: "checkbox", checked: true, value: d.id });
      box.addEventListener("change", () => {
        if (box.checked) state.datasets.add(d.id);
        else state.datasets.delete(d.id);
        void draw();
      });
      return h("label", { class: "toggle", title: d.path }, box, `${d.id} (${count})`);
    }),
  );

  const pick = (i: number): void => {
    state.selected = state.selected === i ? null : i;
    void draw();
  };
  const draw = async (): Promise<void> => {
    const el = await Plotly.react(plot, plotData(state, groups), plotLayout(data.explainedVariance), {
      responsive: true, displaylogo: false, modeBarButtonsToRemove: ["toImage"],
    });
    el.removeAllListeners?.("plotly_click");
    el.on("plotly_click", (event) => {
      const index = event.points[0]?.customdata;
      if (typeof index === "number") pick(index);
    });
    panel.replaceChildren(pointCard(state, pick));
  };
  search.addEventListener("input", () => {
    state.query = search.value;
    void draw();
  });

  const variance = data.explainedVariance.reduce((a, b) => a + b, 0);
  stage.replaceChildren(
    h("div", { class: "agent-head" },
      h("p", { class: "question" }, data.agent.question),
      h("p", { class: "muted" },
        `${data.points.length.toLocaleString("pt-BR")} textos · ${data.model} · 3 componentes explicam `,
        h("strong", {}, `${(variance * 100).toFixed(1).replace(".", ",")}%`),
        " da variância · ",
        h("a", { href: sourceUrl(data.source.repo, data.source.commit), target: "_blank", rel: "noopener" },
          `${data.source.repo}@${data.source.commit}`),
      ),
    ),
    h("div", { class: "controls" }, search, toggles),
    h("div", { class: "workspace" }, h("div", { class: "canvas plot-wrap" }, plot), panel),
  );
  await draw();
}

export function projectorView(): HTMLElement {
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const stage = h("div", { class: "stage" });
  const root = h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", {},
        h("h2", {}, "Projetor de embeddings"),
        h("p", { class: "lede" },
          "O que cada agente consulta, projetado em 3D a partir dos embeddings do bge-m3. Cada agente novo entra pelo registro model/agents.json."),
      ),
    ),
    tabs,
    stage,
  );

  fetchJson<ProjectorIndex>("index.json")
    .then((index) => {
      const buttons = index.agents.map((agent) => {
        const btn = h("button", { type: "button", role: "tab", class: "tab" },
          agent.label, h("span", { class: "count" }, agent.points.toLocaleString("pt-BR")));
        btn.addEventListener("click", () => {
          buttons.forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
          mountAgent(stage, agent.file).catch((err: unknown) => {
            stage.replaceChildren(h("p", { class: "error" }, `Não consegui carregar a projeção: ${String(err)}`));
          });
        });
        return btn;
      });
      tabs.append(...buttons);
      buttons[0]?.click();
    })
    .catch((err: unknown) => {
      stage.replaceChildren(
        h("p", { class: "error" }, `Sem projeções geradas (${String(err)}). Rode make projector.`),
      );
    });
  return root;
}
