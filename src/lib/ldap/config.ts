/**
 * Configuração LDAP / Active Directory lida EXCLUSIVAMENTE de variáveis de ambiente.
 * Nenhuma credencial fica no código-fonte. Veja `.env.example`.
 *
 * Este módulo só deve ser importado no servidor (Node.js runtime).
 */

export type LdapSecurity = "none" | "starttls" | "ldaps";

export interface LdapConfig {
  url: string;
  security: LdapSecurity;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  loginAttribute: string;
  userFilter: string;
  timeoutMs: number;
  connectTimeoutMs: number;
  tlsRejectUnauthorized: boolean;
  caCertPath?: string;
}

export class LdapConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LdapConfigError";
  }
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string, problems: string[]): string {
  const value = env[name]?.trim();
  if (!value) problems.push(`${name} ausente`);
  return value ?? "";
}

function intFrom(env: Env, name: string, fallback: number, problems: string[]): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    problems.push(`${name} inválido`);
    return fallback;
  }
  return n;
}

/** Verifica se o filtro LDAP tem parênteses balanceados e está envolto em ( ). */
export function isWellFormedFilter(filter: string): boolean {
  if (!filter.startsWith("(") || !filter.endsWith(")")) return false;
  let depth = 0;
  for (let i = 0; i < filter.length; i++) {
    const c = filter[i];
    if (c === "\\") {
      i += 2; // sequência de escape \XX
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

export function parseLdapConfig(env: Env = process.env): LdapConfig {
  const problems: string[] = [];

  const host = required(env, "LDAP_HOST", problems);
  const security = (env.LDAP_SECURITY?.trim().toLowerCase() || "none") as LdapSecurity;
  if (!["none", "starttls", "ldaps"].includes(security)) {
    problems.push("LDAP_SECURITY deve ser none | starttls | ldaps");
  }
  const defaultPort = security === "ldaps" ? 636 : 389;
  const port = intFrom(env, "LDAP_PORT", defaultPort, problems);

  const baseDN = required(env, "LDAP_BASE_DN", problems);
  const bindDN = required(env, "LDAP_BIND_DN", problems);
  const bindPassword = env.LDAP_BIND_PASSWORD ?? "";
  if (!bindPassword) problems.push("LDAP_BIND_PASSWORD ausente");
  for (const name of ["LDAP_BIND_DN", "LDAP_BIND_PASSWORD"]) {
    const value = env[name];
    if (value && ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"')))) {
      problems.push(`${name} contém aspas literais; use aspas somente no arquivo .env`);
    }
  }

  const loginAttribute = env.LDAP_LOGIN_ATTRIBUTE?.trim() || "sAMAccountName";
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(loginAttribute)) {
    problems.push("LDAP_LOGIN_ATTRIBUTE inválido");
  }

  const userFilter = required(env, "LDAP_USER_FILTER", problems);
  if (userFilter && !isWellFormedFilter(userFilter)) {
    problems.push("LDAP_USER_FILTER malformado");
  }

  const timeoutMs = intFrom(env, "LDAP_TIMEOUT_MS", 5000, problems);
  const connectTimeoutMs = intFrom(env, "LDAP_CONNECT_TIMEOUT_MS", 5000, problems);
  const tlsRejectUnauthorized = (env.LDAP_TLS_REJECT_UNAUTHORIZED ?? "true").trim() !== "false";
  const caCertPath = env.LDAP_CA_CERT_PATH?.trim() || undefined;

  if (problems.length) {
    throw new LdapConfigError(`Configuração LDAP inválida: ${problems.join("; ")}`);
  }

  const scheme = security === "ldaps" ? "ldaps" : "ldap";
  return {
    url: `${scheme}://${host}:${port}`,
    security,
    baseDN,
    bindDN,
    bindPassword,
    loginAttribute,
    userFilter,
    timeoutMs,
    connectTimeoutMs,
    tlsRejectUnauthorized,
    caCertPath,
  };
}

let cached: LdapConfig | null = null;

export function getLdapConfig(): LdapConfig {
  if (!cached) cached = parseLdapConfig(process.env);
  return cached;
}
