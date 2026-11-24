// Contrato dos arquivos em model/*.json. O site só desenha o que está aqui.

export type NodeKind =
  | "external"
  | "process"
  | "store"
  | "service"
  | "component"
  | "client"
  | "agent"
  | "guardrail"
  | "model"
  | "actor";

export type NodeStatus = "active" | "experimental" | "planned";
export type Severity = "high" | "medium" | "low";

export interface Metric {
  label: string;
  value: string;
  target: string;
  pass: boolean | null;
  note?: string;
}

export interface ArchNode {
  id: string;
  lane: string;
  label: string;
  kind: NodeKind;
  status: NodeStatus;
  description: string;
  repo?: string;
  path?: string;
  metrics?: Metric[];
}

export interface ArchEdge {
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed";
}

export interface Finding {
  severity: Severity;
  title: string;
  text: string;
}

export interface SourceRef {
  repo: string;
  commit: string;
}

export interface ArchitectureModel {
  id: string;
  title: string;
  subtitle: string;
  asOf: string;
  sources: SourceRef[];
  lanes: { id: string; title: string }[];
  nodes: ArchNode[];
  edges: ArchEdge[];
  findings: Finding[];
}
