// Agrupamento, cores e busca. Puro, testável sem WebGL.

import type { ProjectorPoint } from "./types";

export const PALETTE = [
  "#2a78d6", "#e8743b", "#19a979", "#a15fd6", "#d64550",
  "#c9a227", "#1fa3b8", "#7c8b9c", "#e05fa8", "#5d8c2f",
  "#8a5a44", "#3f51b5", "#00897b",
];

export type ColorBy = "group" | "dataset";

export function keyOf(point: ProjectorPoint, by: ColorBy): string {
  return by === "group" ? point.group : point.dataset;
}

/** Categorias da maior para a menor; a posição define a cor, então ela é estável. */
export function categoriesOf(points: ProjectorPoint[], by: ColorBy): { key: string; count: number; color: string }[] {
  const counts = new Map<string, number>();
  for (const p of points) counts.set(keyOf(p, by), (counts.get(keyOf(p, by)) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count], i) => ({ key, count, color: PALETTE[i % PALETTE.length] ?? "#7c8b9c" }));
}

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/** Busca sem diferenciar maiúsculas nem acentos ("acido" acha "ácido"). */
export function search(points: ProjectorPoint[], query: string, limit = 50): number[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const found: number[] = [];
  for (let i = 0; i < points.length && found.length < limit; i++) {
    const p = points[i] as ProjectorPoint;
    if (normalize(`${p.text} ${p.label} ${p.id}`).includes(q)) found.push(i);
  }
  return found;
}

export function shortLabel(point: ProjectorPoint, max = 42): string {
  const base = point.label || point.text;
  return base.length > max ? `${base.slice(0, max - 1).trimEnd()}…` : base;
}
