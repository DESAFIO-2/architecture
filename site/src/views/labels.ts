import type { NodeKind, NodeStatus, Severity } from "../model/types";

export const KIND_LABEL: Record<NodeKind, string> = {
  external: "Fonte externa",
  process: "Processo",
  store: "Dados",
  service: "Serviço",
  component: "Componente",
  client: "Cliente",
  agent: "Agente",
  guardrail: "Guardrail",
  model: "Modelo",
  actor: "Pessoa",
};

export const STATUS_LABEL: Record<NodeStatus, string> = {
  active: "Em uso",
  experimental: "Experimental",
  planned: "Planejado",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
