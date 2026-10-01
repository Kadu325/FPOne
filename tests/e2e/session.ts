import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

/** Usuários do scripts/e2e-seed.ts. Sessões emitidas no global-setup (o login real exige o AD). */
export const E2E_USERS = ["E2E002", "E2E003", "E2E004", "E2E005", "E2E006"] as const;
export type E2EUser = (typeof E2E_USERS)[number];

export const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), ".auth");
export const authFile = (matricula: string) => join(AUTH_DIR, `${matricula}.json`);

/** Entra com a sessão salva no global-setup (sem novo login) e espera a Home. */
export async function signIn(page: Page, matricula: E2EUser): Promise<void> {
  const state = JSON.parse(readFileSync(authFile(matricula), "utf8")) as { cookies: Parameters<ReturnType<Page["context"]>["addCookies"]>[0] };
  await page.context().clearCookies();
  await page.context().addCookies(state.cookies);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), / })).toBeVisible();
}
