/**
 * Auth.js (NextAuth v5) — autenticação com suporte a Active Directory (LDAP)
 * e fallback auditado de desenvolvimento/demo local.
 */
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "./auth.config";
import { authenticateWithAD } from "./lib/ldap/ad-auth";
import { AdAuthError, type AuthFailureCode } from "./lib/auth/errors";
import { clientIpFrom, ipLimiter, userLimiter } from "./lib/auth/rate-limit";
import { normalizeUsername } from "./lib/auth/username";
import { describeError, logAuthEvent } from "./lib/logger";
import { audit } from "./server/audit/audit";
import { db } from "./server/db";
import { loadSessionUser, resolveAdLogin, resolveLocalFallbackLogin } from "./server/auth/service";

/** Erro que chega na server action com um `code` seguro para a UI. */
class LoginError extends CredentialsSignin {
  constructor(code: AuthFailureCode) {
    super();
    this.code = code;
  }
}

/** Tempo mínimo de resposta em falhas: dificulta enumeração por tempo e força bruta. */
const MIN_FAILURE_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "FPOne Credenciais",
      credentials: {
        username: { label: "Usuário" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, request) {
        const started = Date.now();
        const username = normalizeUsername(credentials?.username) ?? "(inválido)";
        const userKey = `u:${username.toLowerCase()}`;
        const ip = clientIpFrom(request?.headers);
        const ipKey = ip ? `ip:${ip}` : null;

        const fail = async (code: AuthFailureCode): Promise<never> => {
          const elapsed = Date.now() - started;
          if (elapsed < MIN_FAILURE_MS) await sleep(MIN_FAILURE_MS - elapsed + Math.random() * 200);
          throw new LoginError(code);
        };

        // Bloqueio por excesso de tentativas
        const byUser = userLimiter.check(userKey);
        const byIp = ipKey ? ipLimiter.check(ipKey) : { allowed: true, retryAfterSec: 0 };
        if (!byUser.allowed || !byIp.allowed) {
          logAuthEvent("warn", "auth.rate_limited", { username, ip });
          return fail("rate_limited");
        }

        const adEnabled = process.env.AD_ENABLED !== "false";

        if (adEnabled) {
          try {
            const user = await authenticateWithAD(credentials?.username, credentials?.password);
            userLimiter.reset(userKey);
            const linked = await resolveAdLogin(
              { prisma: db(), ip },
              { username: user.username, emails: [user.email, user.upn], name: user.name, department: user.department, title: user.title },
            );
            if (!linked.ok) {
              logAuthEvent("warn", "auth.not_linked", { username, reason: linked.reason });
              return fail("invalid_credentials");
            }
            return {
              id: linked.value.id,
              uid: linked.value.id,
              sessionVersion: linked.value.sessionVersion,
              username: user.username,
              name: user.name,
              email: user.email ?? user.upn,
              department: user.department,
              jobTitle: user.title,
              groups: user.groups,
            };
          } catch (err) {
            if (err instanceof AdAuthError && err.code === "password_expired") {
              return fail("password_expired");
            }
            logAuthEvent("info", "auth.ad_failed_attempting_local", { username, ...describeError(err) });
          }
        }

        // Fallback local/demo seguro auditado
        try {
          const local = await resolveLocalFallbackLogin(
            { prisma: db(), ip },
            username,
            typeof credentials?.password === "string" ? credentials.password : "",
          );

          if (local.ok) {
            userLimiter.reset(userKey);
            return {
              id: local.value.id,
              uid: local.value.id,
              sessionVersion: local.value.sessionVersion,
              username,
              name: local.value.name,
              email: `${username}@fazendaprogresso.com.br`,
              department: null,
              jobTitle: null,
              groups: [],
            };
          }

          userLimiter.hit(userKey);
          if (ipKey) ipLimiter.hit(ipKey);
          return fail("invalid_credentials");
        } catch (err) {
          logAuthEvent("error", "auth.unexpected_error", describeError(err));
          return fail("service_unavailable");
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      const { user } = params;
      if (user?.uid !== undefined && user.sessionVersion !== undefined) {
        token.uid = user.uid;
        token.sv = user.sessionVersion;
        delete token.email;
        delete token.picture;
      }
      if (!token.uid || token.sv === undefined) return null;
      const current = await loadSessionUser(db(), token.uid, token.sv);
      if (!current) return null;
      token.name = current.name;
      token.matricula = current.matricula;
      token.roles = current.roles;
      return token;
    },
    async session(params) {
      const session = await authConfig.callbacks.session(params);
      const { token } = params;
      session.user.id = token.uid ?? "";
      session.user.name = token.name ?? "";
      session.user.matricula = token.matricula ?? "";
      session.user.roles = token.roles ?? [];
      return session;
    },
  },
  events: {
    async signOut(message) {
      const uid = "token" in message ? message.token?.uid : undefined;
      if (uid) await audit(db(), { actorId: uid, action: "LOGOUT", entity: "user", entityId: uid });
    },
  },
  logger: {
    error(error) {
      if (error instanceof CredentialsSignin) return;
      logAuthEvent("error", "authjs.error", describeError(error));
    },
    warn(code) {
      logAuthEvent("warn", "authjs.warn", { code });
    },
  },
});
