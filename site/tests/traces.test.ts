import { describe, expect, it } from "vitest";
import { appearance, baseSize, type Focus } from "../src/projector/appearance";
import { easeInOutCubic, flatten, frameAt, iterationAt } from "../src/projector/motion";
import { categoriesOf, search, shortLabel } from "../src/projector/traces";
import type { ProjectorPoint } from "../src/projector/types";

const point = (id: string, dataset: string, group: string, text = id, neighbors: number[] = []): ProjectorPoint =>
  ({ id, dataset, group, label: "", text, neighbors, similarity: neighbors.map(() => 0.9) });

const points = [
  point("1", "a", "bloquear", "Qual remédio tomo?", [1]),
  point("2", "a", "bloquear", "Me indica um remédio", [0]),
  point("3", "b", "permitir", "Ácido fólico no SUS", [0]),
];

const focus = (over: Partial<Focus> = {}): Focus => ({
  colorBy: "group", hiddenDatasets: new Set(), hiddenCategories: new Set(),
  selected: null, hovered: null, isolate: false, matches: [], ...over,
});

describe("categorias e busca", () => {
  it("ordena pelo tamanho e dá cor estável", () => {
    const cats = categoriesOf(points, "group");
    expect(cats.map((c) => [c.key, c.count])).toEqual([["bloquear", 2], ["permitir", 1]]);
    expect(categoriesOf(points, "group")[1]?.color).toBe(cats[1]?.color);
  });

  it("busca sem acento e sem diferenciar maiúsculas", () => {
    expect(search(points, "acido")).toEqual([2]);
    expect(search(points, "REMÉDIO")).toEqual([0, 1]);
    expect(search(points, "  ")).toEqual([]);
  });

  it("encurta rótulos longos", () => {
    expect(shortLabel(point("x", "a", "g", "a".repeat(100)), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("animação", () => {
  it("suaviza nas pontas e respeita os limites", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(2)).toBe(1);
  });

  it("interpola entre quadros vizinhos", () => {
    const frames = [[0, 0, 0], [2, 2, 2], [4, 4, 4]];
    expect([...frameAt(new Float32Array(3), frames, 0.25)]).toEqual([1, 1, 1]);
    expect([...frameAt(new Float32Array(3), frames, 1)]).toEqual([4, 4, 4]);
    expect(iterationAt([1, 10, 600], 0.25)).toBe(6);
  });

  it("2D zera só o eixo Z", () => {
    expect([...flatten([1, 2, 3, 4, 5, 6])]).toEqual([1, 2, 0, 4, 5, 0]);
  });
});

describe("aparência", () => {
  it("esconde dataset desligado sem mexer nos outros", () => {
    const a = appearance(points, focus({ hiddenDatasets: new Set(["b"]) }));
    expect(a.sizes[2]).toBe(0);
    expect(a.sizes[0]).toBeCloseTo(baseSize(points.length));
  });

  it("seleção realça a vizinhança e apaga o resto", () => {
    const a = appearance(points, focus({ selected: 0 }));
    expect(a.sizes[0]!).toBeGreaterThan(a.sizes[1]!);
    expect(a.alphas[1]).toBe(1);
    expect(a.alphas[2]!).toBeLessThan(0.5);
  });

  it("isolar some com quem não é vizinho", () => {
    const a = appearance(points, focus({ selected: 0, isolate: true }));
    expect(a.sizes[2]).toBe(0);
  });
});
