import { describe, expect, it } from "vitest";
import { groupsOf, matches, seriesByGroup } from "../src/projector/traces";
import type { ProjectorPoint } from "../src/projector/types";

const point = (id: string, dataset: string, group: string, text = id): ProjectorPoint =>
  ({ id, dataset, group, label: "", text, x: 0, y: 0, z: 0, neighbors: [] });

const points = [point("1", "a", "bloquear"), point("2", "a", "bloquear"), point("3", "b", "permitir", "Insulina NPH")];

describe("projetor", () => {
  it("ordena grupos pelo tamanho e mantém a cor estável", () => {
    const groups = groupsOf(points);
    expect(groups).toEqual(["bloquear", "permitir"]);
    const all = seriesByGroup(points, new Set(["a", "b"]), groups);
    const onlyB = seriesByGroup(points, new Set(["b"]), groups);
    expect(all.map((s) => s.indices)).toEqual([[0, 1], [2]]);
    expect(onlyB[0]?.color).toBe(all[1]?.color);
  });

  it("busca sem diferenciar maiúsculas", () => {
    expect(matches(points[2]!, "insulina")).toBe(true);
    expect(matches(points[2]!, "   ")).toBe(false);
  });
});
