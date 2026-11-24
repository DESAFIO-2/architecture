// Transformação pura de pontos em séries por grupo. Testável sem Plotly.

import type { ProjectorPoint } from "./types";

export const PALETTE = [
  "#2a78d6", "#e8743b", "#19a979", "#a15fd6", "#d64550",
  "#c9a227", "#1fa3b8", "#7c8b9c", "#e05fa8", "#5d8c2f",
  "#8a5a44", "#3f51b5", "#00897b",
];

export interface Series {
  group: string;
  color: string;
  indices: number[];
}

/** Agrupa os pontos visíveis. Grupos maiores primeiro; a cor segue a ordem de `allGroups`. */
export function seriesByGroup(
  points: ProjectorPoint[],
  visibleDatasets: ReadonlySet<string>,
  allGroups: string[],
): Series[] {
  const byGroup = new Map<string, number[]>();
  points.forEach((p, i) => {
    if (!visibleDatasets.has(p.dataset)) return;
    const list = byGroup.get(p.group) ?? [];
    list.push(i);
    byGroup.set(p.group, list);
  });
  return [...byGroup.entries()]
    .map(([group, indices]) => ({
      group,
      indices,
      color: PALETTE[allGroups.indexOf(group) % PALETTE.length] ?? "#7c8b9c",
    }))
    .sort((a, b) => b.indices.length - a.indices.length || a.group.localeCompare(b.group));
}

export function groupsOf(points: ProjectorPoint[]): string[] {
  const counts = new Map<string, number>();
  for (const p of points) counts.set(p.group, (counts.get(p.group) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([g]) => g);
}

export function matches(point: ProjectorPoint, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("pt-BR");
  if (!q) return false;
  return `${point.text} ${point.label} ${point.id}`.toLocaleLowerCase("pt-BR").includes(q);
}
