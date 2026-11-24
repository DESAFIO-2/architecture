import { describe, expect, it } from "vitest";
import { GEOMETRY, layoutModel, neighborsOf, routeEdge } from "../src/diagram/layout";
import { MODELS } from "../src/model/catalog";

describe("layoutModel", () => {
  const layout = layoutModel(MODELS.atual);

  it("posiciona todos os nós dentro da tela, sem sobreposição", () => {
    const boxes = [...layout.boxes.values()];
    expect(boxes).toHaveLength(MODELS.atual.nodes.length);
    for (const a of boxes) {
      expect(a.x + a.width).toBeLessThanOrEqual(layout.width);
      expect(a.y + a.height).toBeLessThanOrEqual(layout.height);
      for (const b of boxes) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap, `${a.id} x ${b.id}`).toBe(false);
      }
    }
  });

  it("desenha uma curva por aresta", () => {
    expect(layout.edges).toHaveLength(MODELS.atual.edges.length);
  });
});

describe("routeEdge", () => {
  const box = (id: string, x: number, y: number) => ({ id, x, y, width: GEOMETRY.nodeWidth, height: GEOMETRY.nodeHeight });

  it("sai pela direita quando o destino está à direita", () => {
    const path = routeEdge({ from: "a", to: "b" }, box("a", 0, 0), box("b", 300, 0));
    expect(path.d.startsWith(`M ${GEOMETRY.nodeWidth} `)).toBe(true);
  });

  it("sai pela esquerda quando o destino está à esquerda", () => {
    const path = routeEdge({ from: "a", to: "b" }, box("a", 300, 0), box("b", 0, 0));
    expect(path.d.startsWith("M 300 ")).toBe(true);
  });
});

describe("neighborsOf", () => {
  it("inclui o próprio nó e as ligações nos dois sentidos", () => {
    const near = neighborsOf(MODELS.ia, "triagem");
    expect(near).toEqual(new Set(["triagem", "pii", "camada1", "injecao", "camada2", "auditor", "consultor", "sintetizador"]));
  });
});
