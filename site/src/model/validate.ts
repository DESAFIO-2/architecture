import type { ArchitectureModel, NodeKind, NodeStatus } from "./types";

const KINDS: ReadonlySet<NodeKind> = new Set([
  "external", "process", "store", "service", "component",
  "client", "agent", "guardrail", "model", "actor",
]);
const STATUSES: ReadonlySet<NodeStatus> = new Set(["active", "experimental", "planned"]);

/** Devolve a lista de problemas do modelo. Vazia significa modelo consistente. */
export function validateModel(model: ArchitectureModel): string[] {
  const problems: string[] = [];
  const lanes = new Set(model.lanes.map((l) => l.id));
  const ids = new Set<string>();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(model.asOf)) problems.push(`asOf inválido: ${model.asOf}`);
  for (const s of model.sources) {
    if (!/^[0-9a-f]{7,40}$/.test(s.commit)) problems.push(`commit inválido em ${s.repo}: ${s.commit}`);
  }
  for (const n of model.nodes) {
    if (ids.has(n.id)) problems.push(`nó repetido: ${n.id}`);
    ids.add(n.id);
    if (!lanes.has(n.lane)) problems.push(`nó ${n.id} em raia inexistente: ${n.lane}`);
    if (!KINDS.has(n.kind)) problems.push(`nó ${n.id} com tipo desconhecido: ${n.kind}`);
    if (!STATUSES.has(n.status)) problems.push(`nó ${n.id} com status desconhecido: ${n.status}`);
    if (n.path && !n.repo) problems.push(`nó ${n.id} tem path sem repo`);
    if (n.repo && !model.sources.some((s) => s.repo === n.repo)) {
      problems.push(`nó ${n.id} cita repo sem commit em sources: ${n.repo}`);
    }
  }
  for (const e of model.edges) {
    if (!ids.has(e.from)) problems.push(`aresta de nó inexistente: ${e.from}`);
    if (!ids.has(e.to)) problems.push(`aresta para nó inexistente: ${e.to}`);
  }
  for (const lane of lanes) {
    if (!model.nodes.some((n) => n.lane === lane)) problems.push(`raia vazia: ${lane}`);
  }
  return problems;
}
