import { h } from "../dom";
import { sourceUrl } from "../model/catalog";
import { appearance, isVisible, neighborhood, type Focus } from "./appearance";
import { flatten, frameAt, iterationAt } from "./motion";
import { categoriesOf, search, shortLabel, type ColorBy } from "./traces";
import type { AgentProjection, ProjectorIndex, ProjectorLayout } from "./types";

const DATA_DIR = "./data/projector";

/** Estado da tela: o foco visual mais as escolhas de projeção e vista. */
interface ViewFocus extends Focus {
  layout: ProjectorLayout["id"];
  flat: boolean;
  rotate: boolean;
  hiddenDatasets: Set<string>;
  hiddenCategories: Set<string>;
  matches: number[];
}
const REPLAY_MS = 6500;
const MORPH_MS = 1100;

const prefersReducedMotion = (): boolean =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const SCHEMA = "projector/v2";

/**
 * Sempre revalida com o servidor (`no-cache`): o GitHub Pages manda guardar por 10 minutos,
 * e um JSON antigo no cache quebraria o código novo depois de cada atualização dos dados.
 */
async function fetchJson<T extends { schema: string }>(file: string): Promise<T> {
  const response = await fetch(`${DATA_DIR}/${file}`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const data = (await response.json()) as T;
  if (data.schema !== SCHEMA) {
    throw new Error(`${file} está no formato ${data.schema}, esperado ${SCHEMA}. Recarregue a página.`);
  }
  return data;
}

const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;

function segmented<T extends string>(
  label: string,
  options: { value: T; text: string }[],
  current: T,
  onChange: (value: T) => void,
): { root: HTMLElement; set: (value: T) => void; disable: (value: T, off: boolean) => void } {
  const buttons = options.map((o) => {
    const b = h("button", { type: "button", role: "radio", "data-value": o.value }, o.text);
    b.addEventListener("click", () => onChange(o.value));
    return b;
  });
  const set = (value: T): void => buttons.forEach((b) => b.setAttribute("aria-checked", String(b.dataset["value"] === value)));
  set(current);
  return {
    root: h("div", { class: "segmented", role: "radiogroup", "aria-label": label }, ...buttons),
    set,
    disable: (value, off) => {
      const b = buttons.find((x) => x.dataset["value"] === value);
      if (b) b.disabled = off;
    },
  };
}

function group(title: string, ...children: (Node | null)[]): HTMLElement {
  return h("div", { class: "control-group" }, h("h4", {}, title), ...children);
}

/** Monta o projetor de um agente. A cena se libera sozinha quando sai da página. */
async function mountAgent(stage: HTMLElement, file: string): Promise<void> {
  stage.replaceChildren(h("p", { class: "muted pad" }, "Carregando a projeção…"));
  const [{ ProjectorScene }, data] = await Promise.all([
    import("./scene"),
    fetchJson<AgentProjection>(file),
  ]);
  const { points } = data;
  const layouts = new Map(data.layouts.map((l) => [l.id, l]));
  const reduced = prefersReducedMotion();

  const focus: ViewFocus = {
    layout: layouts.has("tsne") ? "tsne" : "pca",
    flat: false,
    rotate: !reduced,
    colorBy: "group",
    hiddenDatasets: new Set(),
    hiddenCategories: new Set(),
    selected: null,
    hovered: null,
    isolate: false,
    matches: [],
  };
  let replay: { start: number; progress: number } | null = null;

  // ---------- Estrutura ----------
  const canvasHost = h("div", { class: "gl" });
  const labels = h("div", { class: "gl-labels", "aria-hidden": "true" });
  const tooltip = h("div", { class: "gl-tooltip", hidden: true });
  const iterationBadge = h("div", { class: "gl-badge", hidden: true });
  const resetBtn = h("button", { type: "button", class: "icon-btn", title: "Recentralizar câmera" }, "⟲");
  const stageEl = h("div", { class: "gl-stage" },
    canvasHost, labels, tooltip, iterationBadge,
    h("div", { class: "gl-hint" }, "Arraste para girar · role para aproximar · clique num ponto"),
    h("div", { class: "gl-actions" }, resetBtn),
  );

  const note = h("p", { class: "muted small" });
  const layoutCtl = segmented("Projeção", data.layouts.map((l) => ({ value: l.id, text: l.label })), focus.layout,
    (v) => setLayout(v));
  const replayBtn = h("button", { type: "button", class: "btn primary" }, "▶ Reproduzir otimização");
  const progress = h("div", { class: "progress" }, h("span", {}));
  const viewCtl = segmented("Vista", [{ value: "3d", text: "3D" }, { value: "2d", text: "2D" }], "3d",
    (v) => setFlat(v === "2d"));
  const rotateBox = h("input", { type: "checkbox", checked: focus.rotate });
  const colorCtl = segmented<ColorBy>("Colorir por", [{ value: "group", text: "Grupo" }, { value: "dataset", text: "Dataset" }],
    "group", (v) => setColorBy(v));
  const legend = h("ul", { class: "legend-list" });
  const datasets = h("div", { class: "toggles column" },
    ...data.source.datasets.map((d) => {
      const count = points.filter((p) => p.dataset === d.id).length;
      const box = h("input", { type: "checkbox", checked: true });
      box.addEventListener("change", () => {
        if (box.checked) focus.hiddenDatasets.delete(d.id);
        else focus.hiddenDatasets.add(d.id);
        refresh();
      });
      return h("label", { class: "toggle", title: d.path }, box, h("span", {}, d.id), h("span", { class: "count" }, String(count)));
    }),
  );

  const controls = h("aside", { class: "pj-controls" },
    group("Projeção", layoutCtl.root, note),
    group("Animação", replayBtn, progress),
    group("Vista", viewCtl.root, h("label", { class: "toggle" }, rotateBox, "Girar sozinho")),
    group("Colorir por", colorCtl.root, legend),
    group("Datasets", datasets),
  );

  const searchBox = h("input", { type: "search", placeholder: "Buscar (ex.: insulina, SISREG)", "aria-label": "Buscar texto" });
  const results = h("div", { class: "results" });
  const card = h("div", { class: "pj-card" });
  const inspector = h("aside", { class: "pj-inspector" }, searchBox, results, card);

  stage.replaceChildren(
    h("div", { class: "agent-head" },
      h("p", { class: "question" }, data.agent.question),
      h("p", { class: "muted" },
        `${points.length.toLocaleString("pt-BR")} textos · ${data.model} · ${data.dimensions.toLocaleString("pt-BR")} dimensões · `,
        h("a", { href: sourceUrl(data.source.repo, data.source.commit), target: "_blank", rel: "noopener" },
          `${data.source.repo}@${data.source.commit}`),
      ),
    ),
    h("div", { class: "pj" }, controls, stageEl, inspector),
  );

  // ---------- Cena ----------
  const scene = new ProjectorScene(canvasHost, points.length, cssVar("--accent"));
  scene.setAutoRotate(focus.rotate);
  let current = appearance(points, focus);

  const baseFrame = (layoutId: ProjectorLayout["id"]): Float32Array => {
    const frames = layouts.get(layoutId)?.frames ?? [];
    const raw = Float32Array.from(frames[frames.length - 1] ?? []);
    return focus.flat ? flatten(raw) : raw;
  };

  function refresh(): void {
    current = appearance(points, focus);
    scene.setAppearance(current);
    const sel = focus.selected;
    scene.setLinks(sel === null ? [] : (points[sel]?.neighbors ?? []).map((n) => [sel, n] as [number, number]));
    renderLegend();
    renderCard();
  }

  function setLayout(id: ProjectorLayout["id"]): void {
    focus.layout = id;
    layoutCtl.set(id);
    replay = null;
    iterationBadge.hidden = true;
    const layout = layouts.get(id);
    note.textContent = layout?.note ?? "";
    replayBtn.disabled = (layout?.frames.length ?? 0) < 2;
    scene.moveTo(baseFrame(id), reduced ? 0 : MORPH_MS);
  }

  function setFlat(flat: boolean): void {
    focus.flat = flat;
    viewCtl.set(flat ? "2d" : "3d");
    scene.setFlat(flat, reduced ? 0 : 700);
    scene.setAutoRotate(focus.rotate && !flat);
    rotateBox.disabled = flat;
    if (!replay) scene.moveTo(baseFrame(focus.layout), reduced ? 0 : 800);
  }

  function setColorBy(by: ColorBy): void {
    focus.colorBy = by;
    focus.hiddenCategories.clear();
    colorCtl.set(by);
    refresh();
  }

  function select(index: number | null): void {
    focus.selected = index;
    if (index === null) focus.isolate = false;
    refresh();
  }

  function startReplay(): void {
    const layout = layouts.get(focus.layout);
    if (!layout || layout.frames.length < 2) return;
    replay = { start: performance.now(), progress: 0 };
    replayBtn.textContent = "■ Parar";
  }

  function stopReplay(): void {
    replay = null;
    replayBtn.textContent = "▶ Reproduzir otimização";
    iterationBadge.hidden = true;
    (progress.firstElementChild as HTMLElement).style.width = "0%";
  }

  // ---------- Painéis ----------
  function renderLegend(): void {
    legend.replaceChildren(
      ...categoriesOf(points, focus.colorBy).map((c) => {
        const off = focus.hiddenCategories.has(c.key);
        const btn = h("button", { type: "button", class: `legend-row${off ? " off" : ""}`, "aria-pressed": String(!off) },
          h("span", { class: "dot", style: `background:${c.color}` }),
          h("span", { class: "name" }, c.key),
          h("span", { class: "count" }, c.count.toLocaleString("pt-BR")),
        );
        btn.addEventListener("click", () => {
          if (off) focus.hiddenCategories.delete(c.key);
          else focus.hiddenCategories.add(c.key);
          refresh();
        });
        return h("li", {}, btn);
      }),
    );
  }

  function renderResults(): void {
    const query = searchBox.value;
    focus.matches = search(points, query, 200).filter((i) => isVisible(points[i]!, focus));
    if (!query.trim()) {
      results.replaceChildren();
      return;
    }
    const list = h("ol", { class: "result-list" },
      ...focus.matches.slice(0, 8).map((i) => {
        const b = h("button", { type: "button" }, shortLabel(points[i]!, 60));
        b.addEventListener("click", () => select(i));
        return h("li", {}, b);
      }),
    );
    results.replaceChildren(
      h("p", { class: "muted small" },
        `${focus.matches.length}${focus.matches.length === 200 ? "+" : ""} resultado${focus.matches.length === 1 ? "" : "s"}`),
      list,
    );
  }

  function renderCard(): void {
    const i = focus.selected;
    const point = i === null ? undefined : points[i];
    if (i === null || !point) {
      const cats = categoriesOf(points, focus.colorBy);
      card.replaceChildren(
        h("div", { class: "details empty" },
          h("p", {}, "Clique num ponto para ler o texto e ver os vizinhos mais próximos."),
          h("p", { class: "muted small" },
            `A posição é uma projeção (${focus.layout === "tsne" ? "t-SNE" : "PCA"}). A vizinhança e a similaridade são calculadas no espaço original de ${data.dimensions} dimensões, por cosseno.`),
          h("p", { class: "muted small" }, `${cats.length} ${focus.colorBy === "group" ? "grupos" : "datasets"} · ${points.length} pontos`),
        ),
      );
      return;
    }
    const crossGroup = point.neighbors.filter((n) => points[n]?.group !== point.group).length;
    const isolate = h("button", { type: "button", class: "btn" }, focus.isolate ? "Mostrar todos" : "Isolar vizinhança");
    isolate.addEventListener("click", () => {
      focus.isolate = !focus.isolate;
      refresh();
    });
    const clear = h("button", { type: "button", class: "btn ghost" }, "Limpar");
    clear.addEventListener("click", () => select(null));
    card.replaceChildren(
      h("div", { class: "details" },
        h("div", { class: "chips" },
          h("span", { class: "chip status-active" }, point.group),
          h("span", { class: "chip" }, point.dataset),
        ),
        h("h3", {}, shortLabel(point, 90)),
        h("p", { class: "quote" }, point.text),
        h("p", { class: "muted small mono" }, point.id),
        h("div", { class: "row" }, isolate, clear),
        h("h4", {}, "Vizinhos mais próximos"),
        crossGroup
          ? h("p", { class: "verdict-line" }, `${crossGroup} de ${point.neighbors.length} vizinhos são de outro grupo.`)
          : h("p", { class: "muted small" }, "Todos os vizinhos são do mesmo grupo."),
        h("ol", { class: "neighbors" },
          ...point.neighbors.map((n, k) => {
            const other = points[n];
            if (!other) return null;
            const sim = point.similarity[k] ?? 0;
            const btn = h("button", { type: "button", class: "neighbor" },
              h("span", { class: "sim" },
                h("span", { class: "bar" }, h("span", { style: `width:${Math.max(0, sim) * 100}%` })),
                h("span", { class: "num" }, sim.toFixed(3).replace(".", ",")),
              ),
              h("span", { class: `chip ${other.group === point.group ? "status-active" : "status-experimental"}` }, other.group),
              h("span", {}, shortLabel(other, 80)),
            );
            btn.addEventListener("click", () => select(n));
            return h("li", {}, btn);
          }),
        ),
      ),
    );
  }

  // ---------- Rótulos e dica flutuantes (a cada quadro) ----------
  const labelPool = new Map<number, HTMLElement>();
  function placeLabels(): void {
    const wanted = new Set<number>();
    if (focus.selected !== null) neighborhood(points, focus.selected).forEach((i) => wanted.add(i));
    else focus.matches.slice(0, 12).forEach((i) => wanted.add(i));
    for (const [i, el] of labelPool) {
      if (!wanted.has(i)) {
        el.remove();
        labelPool.delete(i);
      }
    }
    for (const i of wanted) {
      if ((current.sizes[i] ?? 0) === 0) continue;
      let el = labelPool.get(i);
      if (!el) {
        el = h("span", { class: i === focus.selected ? "gl-label main" : "gl-label" }, shortLabel(points[i]!, 34));
        labels.append(el);
        labelPool.set(i, el);
      }
      const s = scene.project(i);
      el.style.transform = `translate(${s.x + 8}px, ${s.y - 8}px)`;
      el.style.opacity = s.visible ? "1" : "0";
    }
    if (focus.hovered !== null) {
      const s = scene.project(focus.hovered);
      tooltip.style.transform = `translate(${s.x + 14}px, ${s.y + 14}px)`;
    }
  }

  scene.onFrame = () => {
    if (replay) {
      const layout = layouts.get(focus.layout);
      replay.progress = Math.min(1, (performance.now() - replay.start) / REPLAY_MS);
      if (layout) {
        const frame = frameAt(new Float32Array(points.length * 3), layout.frames, replay.progress);
        scene.moveTo(focus.flat ? flatten(frame) : frame, 0);
        iterationBadge.hidden = false;
        iterationBadge.textContent = `t-SNE · iteração ${iterationAt(layout.iterations, replay.progress)} de ${layout.iterations[layout.iterations.length - 1] ?? 0}`;
        (progress.firstElementChild as HTMLElement).style.width = pct(replay.progress);
      }
      if (replay.progress >= 1) stopReplay();
    }
    placeLabels();
  };

  // ---------- Eventos ----------
  let downAt = { x: 0, y: 0 };
  scene.canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
  scene.canvas.addEventListener("pointerup", (e) => {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return; // foi arrasto
    select(scene.pick(e.clientX, e.clientY, current.sizes));
  });
  let hoverQueued = false;
  scene.canvas.addEventListener("pointermove", (e) => {
    if (hoverQueued || e.buttons) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const hit = scene.pick(e.clientX, e.clientY, current.sizes);
      if (hit === focus.hovered) return;
      focus.hovered = hit;
      scene.canvas.style.cursor = hit === null ? "grab" : "pointer";
      tooltip.hidden = hit === null;
      if (hit !== null) {
        const p = points[hit]!;
        tooltip.replaceChildren(h("strong", {}, p.group), h("span", {}, shortLabel(p, 110)));
      }
      current = appearance(points, focus);
      scene.setAppearance(current);
    });
  });
  scene.canvas.addEventListener("pointerleave", () => {
    focus.hovered = null;
    tooltip.hidden = true;
    current = appearance(points, focus);
    scene.setAppearance(current);
  });
  replayBtn.addEventListener("click", () => (replay ? stopReplay() : startReplay()));
  rotateBox.addEventListener("change", () => {
    focus.rotate = rotateBox.checked;
    scene.setAutoRotate(focus.rotate && !focus.flat);
  });
  resetBtn.addEventListener("click", () => scene.resetCamera());
  searchBox.addEventListener("input", () => {
    renderResults();
    refresh();
  });
  stage.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && focus.selected !== null) select(null);
  });

  // ---------- Início: a nuvem se forma diante de quem abre ----------
  note.textContent = layouts.get(focus.layout)?.note ?? "";
  refresh();
  if (focus.layout === "tsne" && !reduced) {
    const first = layouts.get("tsne")?.frames[0] ?? [];
    scene.moveTo(Float32Array.from(first), 0);
    startReplay();
  } else {
    scene.moveTo(baseFrame(focus.layout), 0);
  }
}

export function projectorView(): HTMLElement {
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const stage = h("div", { class: "stage" });
  const root = h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", {},
        h("h2", {}, "Projetor de embeddings"),
        h("p", { class: "lede" },
          "O que cada agente consulta, em 3D, a partir dos embeddings do bge-m3. Cada agente novo entra pelo registro model/agents.json."),
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
          // Link direto para o agente, sem disparar nova renderização da rota.
          history.replaceState(null, "", `#/projetor/${agent.id}`);
          mountAgent(stage, agent.file).catch((err: unknown) => {
            stage.replaceChildren(h("p", { class: "error" }, `Não consegui carregar a projeção: ${String(err)}`));
          });
        });
        return btn;
      });
      tabs.append(...buttons);
      const wanted = location.hash.split("/")[2];
      const start = index.agents.findIndex((a) => a.id === wanted);
      buttons[Math.max(0, start)]?.click();
    })
    .catch((err: unknown) => {
      stage.replaceChildren(h("p", { class: "error" }, `Sem projeções geradas (${String(err)}). Rode make projector.`));
    });
  return root;
}
