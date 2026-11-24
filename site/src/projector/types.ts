// Contrato do JSON escrito por projector/src/projector/serialize.py (schema projector/v1).

export interface ProjectorPoint {
  id: string;
  dataset: string;
  group: string;
  label: string;
  text: string;
  x: number;
  y: number;
  z: number;
  neighbors: number[];
}

export interface AgentProjection {
  schema: "projector/v1";
  agent: { id: string; label: string; question: string };
  model: string;
  generatedAt: string;
  source: { repo: string; commit: string; datasets: { id: string; path: string }[] };
  explainedVariance: [number, number, number];
  points: ProjectorPoint[];
}

export interface ProjectorIndex {
  schema: "projector/v1";
  agents: { id: string; label: string; file: string; points: number }[];
}
