// Layout puro: raias viram colunas, nós empilham na ordem do modelo.
// Sem DOM aqui, para que a geometria seja testável.

import type { ArchEdge, ArchitectureModel } from "../model/types";

export const GEOMETRY = {
  laneWidth: 186,
  laneGap: 40,
  nodeWidth: 166,
  nodeHeight: 56,
  nodeGap: 14,
  header: 52,
  padding: 16,
} as const;

export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaneBox {
  id: string;
  title: string;
  x: number;
  width: number;
}

export interface EdgePath {
  edge: ArchEdge;
  d: string;
  labelX: number;
  labelY: number;
}

export interface Layout {
  width: number;
  height: number;
  lanes: LaneBox[];
  boxes: Map<string, Box>;
  edges: EdgePath[];
}

export function layoutModel(model: ArchitectureModel): Layout {
  const g = GEOMETRY;
  const lanes: LaneBox[] = model.lanes.map((lane, i) => ({
    id: lane.id,
    title: lane.title,
    x: g.padding + i * (g.laneWidth + g.laneGap),
    width: g.laneWidth,
  }));
  const laneX = new Map(lanes.map((l) => [l.id, l.x]));
  const boxes = new Map<string, Box>();
  const filled = new Map<string, number>();

  for (const node of model.nodes) {
    const row = filled.get(node.lane) ?? 0;
    filled.set(node.lane, row + 1);
    const x = (laneX.get(node.lane) ?? 0) + (g.laneWidth - g.nodeWidth) / 2;
    const y = g.header + g.padding + row * (g.nodeHeight + g.nodeGap);
    boxes.set(node.id, { id: node.id, x, y, width: g.nodeWidth, height: g.nodeHeight });
  }

  const tallest = Math.max(0, ...filled.values());
  const height = g.header + g.padding * 2 + tallest * (g.nodeHeight + g.nodeGap);
  const width = g.padding * 2 + lanes.length * g.laneWidth + (lanes.length - 1) * g.laneGap;
  const edges = model.edges.flatMap((edge) => {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    return from && to ? [routeEdge(edge, from, to)] : [];
  });
  return { width, height, lanes, boxes, edges };
}

/** Curva da borda de um nó até a do outro, saindo pelo lado voltado para o destino. */
export function routeEdge(edge: ArchEdge, from: Box, to: Box): EdgePath {
  const midFrom = from.y + from.height / 2;
  const midTo = to.y + to.height / 2;

  if (Math.abs(from.x - to.x) < 1) {
    // Mesma raia: contorna pela direita.
    const x = from.x + from.width;
    const bulge = 26 + Math.min(40, Math.abs(midTo - midFrom) / 6);
    const d = `M ${x} ${midFrom} C ${x + bulge} ${midFrom}, ${x + bulge} ${midTo}, ${x} ${midTo}`;
    return { edge, d, labelX: x + bulge * 0.75, labelY: (midFrom + midTo) / 2 };
  }

  const forward = to.x > from.x;
  const x1 = forward ? from.x + from.width : from.x;
  const x2 = forward ? to.x : to.x + to.width;
  const pull = Math.max(30, Math.abs(x2 - x1) / 2);
  const c1 = forward ? x1 + pull : x1 - pull;
  const c2 = forward ? x2 - pull : x2 + pull;
  const d = `M ${x1} ${midFrom} C ${c1} ${midFrom}, ${c2} ${midTo}, ${x2} ${midTo}`;
  return { edge, d, labelX: (x1 + x2) / 2, labelY: (midFrom + midTo) / 2 };
}

/** Nós ligados diretamente ao nó escolhido, nos dois sentidos. */
export function neighborsOf(model: ArchitectureModel, id: string): Set<string> {
  const out = new Set<string>([id]);
  for (const e of model.edges) {
    if (e.from === id) out.add(e.to);
    if (e.to === id) out.add(e.from);
  }
  return out;
}
