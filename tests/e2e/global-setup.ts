import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import type { FullConfig } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "../../src/generated/prisma/client";
import { AUTH_DIR, E2E_USERS, authFile } from "./session";

/**
 * Salva uma sessão por usuário E2E. O login é exclusivo via Active Directory, que não existe no
 * ambiente de teste; por isso o cookie de sessão do Auth.js é emitido aqui com o mesmo AUTH_SECRET
 * do servidor (só o id local e a session_version, como no login real). Nada disso existe no código
 * de produção. A tela de login em si continua coberta por auth.spec.ts.
 * Requer DATABASE_URL e AUTH_SECRET no ambiente do Playwright.
 */
export default async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0]?.use ?? {};
  const url = new URL(baseURL ?? "http://localhost:3000");
  const secret = process.env.AUTH_SECRET;
  const databaseUrl = process.env.DATABASE_URL;
  if (!secret || !databaseUrl) throw new Error("E2E: defina AUTH_SECRET e DATABASE_URL (os mesmos do servidor).");

  const secure = url.protocol === "https:";
  const cookieName = `${secure ? "__Secure-" : ""}authjs.session-token`;
  const maxAge = 8 * 60 * 60;
  mkdirSync(AUTH_DIR, { recursive: true });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    for (const matricula of E2E_USERS) {
      const employee = await prisma.employee.findUnique({ where: { matricula }, include: { user: true } });
      if (!employee?.user) throw new Error(`E2E: ${matricula} não encontrado. Rode scripts/e2e-seed.ts.`);
      const value = await encode({ token: { uid: employee.user.id, sv: employee.user.sessionVersion }, secret, salt: cookieName, maxAge });
      const cookie = {
        name: cookieName,
        value,
        domain: url.hostname,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + maxAge,
        httpOnly: true,
        secure,
        sameSite: "Lax" as const,
      };
      writeFileSync(authFile(matricula), JSON.stringify({ cookies: [cookie], origins: [] }));
    }
  } finally {
    await prisma.$disconnect();
  }
}
