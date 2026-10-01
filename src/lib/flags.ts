import { serverEnv } from "./env";

/** Feature flags (CLAUDE.md). Recurso não pronto fica desligado por padrão. */
export function isDemoMode(): boolean {
  return serverEnv().DEMO_MODE;
}

export function isAiSearchEnabled(): boolean {
  return serverEnv().FEATURE_AI_SEARCH;
}
