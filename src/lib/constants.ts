/** Nome oficial do produto (§181). Nunca repetir a string solta. */
export const APP_NAME = "FPOne Intranet";
export const HOME_NAME = "Meu FPOne";
export const ADMIN_NAME = "FPOne Admin";

/** Fuso corporativo (RN-CORE-003). Banco em UTC; exibição e regras de "hoje" neste fuso. */
export const APP_TIMEZONE = "America/Bahia";
export const APP_LOCALE = "pt-BR";

export const DEMO_BADGE_LABEL = "Dados fictícios · modo demo";

/** Empresa exibida abaixo da logo na sidebar. NEXT_PUBLIC_*: gravado no build. */
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "Fazenda Progresso";

/** Ambiente (production | homologacao | development). Fora da produção, a sidebar mostra um selo. */
export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || "production";
const ENV_LABELS: Readonly<Record<string, string>> = { homologacao: "Homologação", development: "Desenvolvimento" };
export const APP_ENV_LABEL: string | null = ENV_LABELS[APP_ENV] ?? null;
