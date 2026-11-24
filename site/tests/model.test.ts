import { describe, expect, it } from "vitest";
import { MODELS, sourceUrl } from "../src/model/catalog";
import type { ArchitectureModel } from "../src/model/types";
import { validateModel } from "../src/model/validate";

describe("model/*.json", () => {
  for (const [key, model] of Object.entries(MODELS)) {
    it(`${key} é consistente`, () => {
      expect(validateModel(model)).toEqual([]);
    });
  }

  it("aponta problemas reais", () => {
    const broken: ArchitectureModel = {
      ...MODELS.atual,
      asOf: "24/11",
      nodes: [...MODELS.atual.nodes, { ...MODELS.atual.nodes[0]!, lane: "nenhuma" }],
      edges: [{ from: "x", to: "rename" }],
    };
    const problems = validateModel(broken);
    expect(problems).toContain("asOf inválido: 24/11");
    expect(problems.some((p) => p.startsWith("nó repetido"))).toBe(true);
    expect(problems.some((p) => p.includes("raia inexistente"))).toBe(true);
    expect(problems).toContain("aresta de nó inexistente: x");
  });

  it("métrica reprovada continua reprovada", () => {
    const qwen7 = MODELS.ia.nodes.find((n) => n.id === "qwen7");
    const faith = qwen7?.metrics?.find((m) => m.label === "S4 Faithfulness");
    expect(faith).toMatchObject({ value: "0,8095", pass: false });
  });
});

describe("sourceUrl", () => {
  it("usa só o primeiro caminho citado", () => {
    expect(sourceUrl("development", "3d0ded5", "backend/app/guardrails, backend/app/seguranca"))
      .toBe("https://github.com/DESAFIO-2/development/tree/3d0ded5/backend/app/guardrails");
    expect(sourceUrl("data-engineering", "8b9f15a", "data/releases (DVC)"))
      .toBe("https://github.com/DESAFIO-2/data-engineering/tree/8b9f15a/data/releases");
  });
});
