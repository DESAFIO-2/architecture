import ai from "../../../model/ai.json";
import system from "../../../model/system.json";
import type { ArchitectureModel } from "./types";

export const MODELS = {
  atual: system as ArchitectureModel,
  ia: ai as ArchitectureModel,
} as const;

export type ModelKey = keyof typeof MODELS;

export function sourceUrl(repo: string, commit: string, path?: string): string {
  const base = `https://github.com/DESAFIO-2/${repo}`;
  if (!path) return `${base}/tree/${commit}`;
  const first = path.split(",")[0]?.trim().split(" ")[0] ?? "";
  return `${base}/tree/${commit}/${first.replace(/\/$/, "")}`;
}
