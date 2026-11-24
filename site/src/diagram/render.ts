import { s } from "../dom";
import type { ArchitectureModel } from "../model/types";
import { STATUS_LABEL } from "../views/labels";
import { layoutModel } from "./layout";

const MAX_CHARS = 21;

function wrap(label: string): string[] {
  const words = label.split(" ");
  const lines: string[] = [""];
  for (const word of words) {
    const last = lines.length - 1;
    const candidate = lines[last] ? `${lines[last]} ${word}` : word;
    if (candidate.length > MAX_CHARS && lines[last]) lines.push(word);
    else lines[last] = candidate;
  }
  return lines.slice(0, 2);
}

/** Desenha o modelo em SVG. `onSelect` recebe o id do nó clicado. */
export function renderDiagram(
  model: ArchitectureModel,
  onSelect: (id: string) => void,
): SVGSVGElement {
  const layout = layoutModel(model);
  const svg = s("svg", {
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    width: layout.width,
    height: layout.height,
    class: "diagram",
    role: "img",
    "aria-label": model.title,
  });

  svg.append(
    s("defs", {},
      s("marker", {
        id: `arrow-${model.id}`, viewBox: "0 0 10 10", refX: 9, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse",
      }, s("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "arrow" })),
    ),
  );

  for (const lane of layout.lanes) {
    svg.append(
      s("rect", { x: lane.x, y: 8, width: lane.width, height: layout.height - 16, rx: 14, class: "lane" }),
      s("text", { x: lane.x + lane.width / 2, y: 36, class: "lane-title" }, lane.title),
    );
  }

  const edgeLayer = s("g", { class: "edges" });
  const labelLayer = s("g", { class: "edge-labels" });
  for (const path of layout.edges) {
    const g = s("g", { class: "edge", "data-from": path.edge.from, "data-to": path.edge.to });
    g.append(
      s("path", {
        d: path.d,
        class: path.edge.style === "dashed" ? "edge-line dashed" : "edge-line",
        "marker-end": `url(#arrow-${model.id})`,
      }),
    );
    if (path.edge.label) {
      labelLayer.append(s("text", {
        x: path.labelX, y: path.labelY - 5, class: "edge-label",
        "data-from": path.edge.from, "data-to": path.edge.to,
      }, path.edge.label));
    }
    edgeLayer.append(g);
  }
  svg.append(edgeLayer);

  for (const node of model.nodes) {
    const box = layout.boxes.get(node.id);
    if (!box) continue;
    const lines = wrap(node.label);
    const g = s("g", {
      class: `node kind-${node.kind} status-${node.status}`,
      "data-id": node.id,
      tabindex: 0,
      role: "button",
      "aria-label": `${node.label}, ${STATUS_LABEL[node.status]}`,
    });
    g.append(s("rect", { x: box.x, y: box.y, width: box.width, height: box.height, rx: 10 }));
    g.append(s("rect", { x: box.x, y: box.y + 10, width: 4, height: box.height - 20, rx: 2, class: "kind-bar" }));
    const firstY = box.y + box.height / 2 - (lines.length - 1) * 8 + 5;
    lines.forEach((line, i) => {
      g.append(s("text", { x: box.x + 16, y: firstY + i * 16, class: "node-label" }, line));
    });
    if (node.metrics?.some((m) => m.pass === false)) {
      g.append(s("circle", { cx: box.x + box.width - 12, cy: box.y + 12, r: 4, class: "fail-dot" }));
    }
    g.addEventListener("click", () => onSelect(node.id));
    g.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(node.id);
      }
    });
    svg.append(g);
  }
  svg.append(labelLayer);
  return svg;
}
