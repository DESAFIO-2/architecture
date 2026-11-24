// Contrato do JSON escrito por projector/src/projector/serialize.py (schema projector/v2).

export interface ProjectorPoint {
  id: string;
  dataset: string;
  group: string;
  label: string;
  text: string;
  neighbors: number[];
  similarity: number[];
}

export interface ProjectorLayout {
  id: "pca" | "tsne";
  label: string;
  note: string;
  /** Iteração de cada quadro (vazio quando a disposição tem um quadro só). */
  iterations: number[];
  /** Cada quadro é [x0, y0, z0, x1, y1, z1, ...], já dentro da esfera de raio 1. */
  frames: number[][];
}

export interface AgentProjection {
  schema: "projector/v2";
  agent: { id: string; label: string; question: string };
  model: string;
  dimensions: number;
  generatedAt: string;
  source: { repo: string; commit: string; datasets: { id: string; path: string }[] };
  explainedVariance: [number, number, number];
  layouts: ProjectorLayout[];
  points: ProjectorPoint[];
}

export interface ProjectorIndex {
  schema: "projector/v2";
  agents: { id: string; label: string; file: string; points: number }[];
}
