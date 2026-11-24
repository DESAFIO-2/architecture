// Decide cor, tamanho e opacidade de cada ponto a partir do estado da tela. Puro.

import { categoriesOf, keyOf, type ColorBy } from "./traces";
import type { ProjectorPoint } from "./types";

export interface Focus {
  colorBy: ColorBy;
  hiddenDatasets: ReadonlySet<string>;
  hiddenCategories: ReadonlySet<string>;
  selected: number | null;
  hovered: number | null;
  isolate: boolean;
  matches: readonly number[];
}

export interface Appearance {
  colors: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
}

const DIM = 0.16;

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Tamanho-base em unidades do mundo: nuvens grandes pedem pontos menores. */
export function baseSize(count: number): number {
  if (count > 2000) return 0.02;
  if (count > 300) return 0.03;
  return 0.05;
}

export function neighborhood(points: ProjectorPoint[], selected: number | null): Set<number> {
  if (selected === null) return new Set();
  return new Set([selected, ...(points[selected]?.neighbors ?? [])]);
}

export function isVisible(point: ProjectorPoint, focus: Focus): boolean {
  return !focus.hiddenDatasets.has(point.dataset) && !focus.hiddenCategories.has(keyOf(point, focus.colorBy));
}

export function appearance(points: ProjectorPoint[], focus: Focus): Appearance {
  const n = points.length;
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const alphas = new Float32Array(n);
  const palette = new Map(categoriesOf(points, focus.colorBy).map((c) => [c.key, hexToRgb(c.color)]));
  const near = neighborhood(points, focus.selected);
  const found = new Set(focus.matches);
  const base = baseSize(n);

  points.forEach((point, i) => {
    const [r, g, b] = palette.get(keyOf(point, focus.colorBy)) ?? [0.5, 0.5, 0.5];
    colors.set([r, g, b], i * 3);

    if (!isVisible(point, focus) || (focus.isolate && near.size > 0 && !near.has(i))) {
      sizes[i] = 0;
      alphas[i] = 0;
      return;
    }
    let size = base;
    let alpha = 0.9;
    if (near.size > 0) {
      alpha = near.has(i) ? 1 : DIM;
      if (near.has(i)) size = base * 1.7;
    } else if (found.size > 0) {
      alpha = found.has(i) ? 1 : DIM;
      if (found.has(i)) size = base * 1.7;
    }
    if (i === focus.selected) size = base * 2.6;
    if (i === focus.hovered) {
      size = Math.max(size, base * 2.2);
      alpha = 1;
    }
    sizes[i] = size;
    alphas[i] = alpha;
  });
  return { colors, sizes, alphas };
}
