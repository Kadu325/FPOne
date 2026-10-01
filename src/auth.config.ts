/**
 * Configuração do Auth.js compatível com o Edge runtime (usada pelo middleware).
 * NÃO importe nada de LDAP aqui — o ldapts depende de módulos Node (net/tls).
 */
import type { NextAuthConfig } from "next-auth";

const SESSION_HOURS = Number(process.env.AUTH_SESSION_HOURS) > 0 ? Number(process.env.AUTH_SESSION_HOURS) : 8;

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_HOURS * 60 * 60,
  },
  providers: [], // o provider de credenciais é adicionado em src/auth.ts
  callbacks: {
    /** Toda rota exige sessão, exceto /login e rotas de api públicas. */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isLoginPage = nextUrl.pathname === "/login" || nextUrl.pathname.startsWith("/login/");
      const isPublicApi = nextUrl.pathname.startsWith("/api/health");

      if (isPublicApi) return true;

      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      return isLoggedIn; // false => redireciona para /login?callbackUrl=...
    },

    jwt({ token, user }) {
      if (user) {
        token.username = user.username;
        token.department = user.department ?? null;
        token.title = user.jobTitle ?? null;
        token.groups = user.groups ?? [];
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.username = token.username as string;
        session.user.department = (token.department as string | null) ?? null;
        session.user.jobTitle = (token.title as string | null) ?? null;
        session.user.groups = (token.groups as string[] | undefined) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
