/**
 * Autenticação via Active Directory (LDAP).
 */
import { readFileSync } from "node:fs";
import type { ConnectionOptions } from "node:tls";
import { Client, InvalidCredentialsError, SizeLimitExceededError } from "ldapts";
import type { ClientOptions, Entry, SearchOptions, SearchResult } from "ldapts";

import { getLdapConfig, type LdapConfig } from "./config";
import { buildUserSearchFilter } from "./escape";
import { AdAuthError } from "../auth/errors";
import { isAcceptablePassword, normalizeUsername } from "../auth/username";
import { describeError, logAuthEvent } from "../logger";

export interface AdUser {
  username: string;
  dn: string;
  name: string;
  email: string | null;
  upn: string | null;
  department: string | null;
  title: string | null;
  groups: string[];
}

export interface LdapClientLike {
  startTLS(options?: ConnectionOptions): Promise<void>;
  bind(dn: string, password?: string): Promise<void>;
  search(baseDN: string, options?: SearchOptions): Promise<SearchResult>;
  unbind(): Promise<void>;
}

export type LdapClientFactory = (options: ClientOptions) => LdapClientLike;

export interface AuthDeps {
  config?: LdapConfig;
  clientFactory?: LdapClientFactory;
}

const USER_ATTRIBUTES = [
  "sAMAccountName",
  "displayName",
  "cn",
  "mail",
  "userPrincipalName",
  "department",
  "title",
  "memberOf",
];
const MAX_GROUPS = 40;

const defaultFactory: LdapClientFactory = (options) => new Client(options);

let caCache: { path: string; data: Buffer } | null = null;

function tlsOptionsFor(cfg: LdapConfig): ConnectionOptions {
  const opts: ConnectionOptions = { rejectUnauthorized: cfg.tlsRejectUnauthorized };
  if (cfg.caCertPath) {
    if (!caCache || caCache.path !== cfg.caCertPath) {
      caCache = { path: cfg.caCertPath, data: readFileSync(cfg.caCertPath) };
    }
    opts.ca = [caCache.data];
  }
  return opts;
}

function clientOptionsFor(cfg: LdapConfig): ClientOptions {
  const options: ClientOptions = {
    url: cfg.url,
    timeout: cfg.timeoutMs,
    connectTimeout: cfg.connectTimeoutMs,
  };
  if (cfg.security === "ldaps") options.tlsOptions = tlsOptionsFor(cfg);
  return options;
}

async function openClient(cfg: LdapConfig, factory: LdapClientFactory): Promise<LdapClientLike> {
  const client = factory(clientOptionsFor(cfg));
  if (cfg.security === "starttls") await client.startTLS(tlsOptionsFor(cfg));
  return client;
}

async function safeUnbind(client: LdapClientLike | null): Promise<void> {
  if (!client) return;
  try {
    await client.unbind();
  } catch {
    /* conexão já encerrada — ignorar */
  }
}

function isInvalidCredentials(err: unknown): boolean {
  if (err instanceof InvalidCredentialsError) return true;
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 49;
}

function isSizeLimitExceeded(err: unknown): boolean {
  if (err instanceof SizeLimitExceededError) return true;
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 4;
}

function adSubCode(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m = /data\s+([0-9a-f]{3,4})/i.exec(msg);
  return m?.[1] ? m[1].toLowerCase() : null;
}

function firstString(value: Entry[string] | undefined): string | null {
  if (value === undefined) return null;
  const v = Array.isArray(value) ? value[0] : value;
  if (v === undefined) return null;
  const s = Buffer.isBuffer(v) ? v.toString("utf8") : String(v);
  return s.length ? s : null;
}

function allStrings(value: Entry[string] | undefined): string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => (Buffer.isBuffer(v) ? v.toString("utf8") : String(v)));
}

function groupCn(dn: string): string {
  const m = /^CN=((?:\\.|[^,])+)/i.exec(dn);
  return m?.[1] ? m[1].replace(/\\(.)/g, "$1") : dn;
}

function toAdUser(entry: Entry, fallbackUsername: string): AdUser {
  const username = firstString(entry.sAMAccountName) ?? fallbackUsername;
  return {
    username,
    dn: entry.dn,
    name: firstString(entry.displayName) ?? firstString(entry.cn) ?? username,
    email: firstString(entry.mail),
    upn: firstString(entry.userPrincipalName),
    department: firstString(entry.department),
    title: firstString(entry.title),
    groups: allStrings(entry.memberOf).map(groupCn).slice(0, MAX_GROUPS),
  };
}

export async function authenticateWithAD(
  rawUsername: unknown,
  rawPassword: unknown,
  deps: AuthDeps = {},
): Promise<AdUser> {
  const username = normalizeUsername(rawUsername);
  if (!username || !isAcceptablePassword(rawPassword)) {
    throw new AdAuthError("invalid_credentials", "input_rejected");
  }
  const password = rawPassword;

  let cfg: LdapConfig;
  try {
    cfg = deps.config ?? getLdapConfig();
  } catch (err) {
    logAuthEvent("error", "auth.ldap.config_error", describeError(err));
    throw new AdAuthError("service_unavailable", "config_error", { cause: err });
  }
  const factory = deps.clientFactory ?? defaultFactory;

  let entry: Entry;
  let serviceClient: LdapClientLike | null = null;
  try {
    try {
      serviceClient = await openClient(cfg, factory);
      await serviceClient.bind(cfg.bindDN, cfg.bindPassword);
    } catch (err) {
      const reason = isInvalidCredentials(err) ? "service_bind_rejected" : "service_connect_failed";
      logAuthEvent("error", `auth.ldap.${reason}`, describeError(err));
      throw new AdAuthError("service_unavailable", reason, { cause: err });
    }

    let entries: Entry[];
    try {
      const filter = buildUserSearchFilter(cfg.userFilter, cfg.loginAttribute, username);
      const result = await serviceClient.search(cfg.baseDN, {
        scope: "sub",
        filter,
        attributes: USER_ATTRIBUTES,
        sizeLimit: 2,
      });
      entries = result.searchEntries;
    } catch (err) {
      if (isSizeLimitExceeded(err)) {
        logAuthEvent("warn", "auth.ldap.ambiguous_user", { username });
        throw new AdAuthError("invalid_credentials", "ambiguous_user", { cause: err });
      }
      logAuthEvent("error", "auth.ldap.search_failed", { username, ...describeError(err) });
      throw new AdAuthError("service_unavailable", "search_failed", { cause: err });
    }

    if (entries.length !== 1) {
      const reason = entries.length === 0 ? "user_not_found_or_disabled" : "ambiguous_user";
      logAuthEvent("info", `auth.ldap.${reason}`, { username });
      throw new AdAuthError("invalid_credentials", reason);
    }
    entry = entries[0] as Entry;
  } finally {
    await safeUnbind(serviceClient);
  }

  let userClient: LdapClientLike | null = null;
  try {
    try {
      userClient = await openClient(cfg, factory);
    } catch (err) {
      logAuthEvent("error", "auth.ldap.user_connect_failed", describeError(err));
      throw new AdAuthError("service_unavailable", "user_connect_failed", { cause: err });
    }
    try {
      await userClient.bind(entry.dn, password);
    } catch (err) {
      if (isInvalidCredentials(err)) {
        const sub = adSubCode(err);
        if (sub === "532" || sub === "773") {
          logAuthEvent("info", "auth.ldap.password_expired", { username, adSubCode: sub });
          throw new AdAuthError("password_expired", `ad_${sub}`, { cause: err });
        }
        logAuthEvent("info", "auth.ldap.bad_password", { username, adSubCode: sub });
        throw new AdAuthError("invalid_credentials", "bad_password", { cause: err });
      }
      logAuthEvent("error", "auth.ldap.user_bind_failed", { username, ...describeError(err) });
      throw new AdAuthError("service_unavailable", "user_bind_failed", { cause: err });
    }
  } finally {
    await safeUnbind(userClient);
  }

  const user = toAdUser(entry, username);
  logAuthEvent("info", "auth.ldap.success", { username: user.username });
  return user;
}
