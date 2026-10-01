import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./session";

/**
 * Pessoas (§107): Comunicação cadastra responsabilidade; o diretório encontra por pergunta
 * ("Quem é responsável pelo Fiscal?"), sem acento/caixa; perfil sem dados sensíveis.
 * Pré-requisito: scripts/e2e-seed.ts.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];


test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "fluxo administrativo no desktop");

test("Comunicação cadastra responsabilidade de um colaborador", async ({ page }) => {
  await signIn(page, "E2E004");
  await page.goto("/admin/colaboradores?q=E2E002");
  await page.getByRole("link", { name: "Colaborador Teste", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Colaborador Teste" })).toBeVisible();
  const section = page.getByRole("region", { name: "Responsabilidades" });
  const existing = section.getByRole("button", { name: /^Remover responsabilidade/ });
  while ((await existing.count()) > 0) await existing.first().click();
  await section.getByRole("button", { name: "Adicionar" }).click();
  await section.getByLabel("Responsabilidade", { exact: true }).fill("Escrituração Fiscal");
  await section.getByLabel(/Palavras-chave/).fill("fiscal, tributos");
  await section.getByRole("button", { name: "Salvar responsabilidades" }).click();
  await expect(section.getByRole("status")).toHaveText("Responsabilidades salvas.");
});

test("diretório responde a pergunta por responsabilidade e perfil não expõe dados sensíveis", async ({ page }) => {
  await signIn(page, "E2E005");
  await page.goto("/pessoas");
  await page.getByRole("main").getByLabel("Buscar").fill("Quem é responsável pelo FISCAL?");
  await page.getByRole("main").getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("status")).toContainText("para “fiscal”");
  await expect(page.getByRole("link", { name: "Colaborador Teste", exact: true })).toBeVisible();
  await expect(page.getByText("Escrituração Fiscal").first()).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);

  await page.getByRole("link", { name: "Colaborador Teste", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Colaborador Teste" })).toBeVisible();
  await expect(page.getByText("Não informado").first()).toBeVisible();
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/E2E002|CPF|\d{3}\.\d{3}\.\d{3}-\d{2}/);
  await expect(page.getByRole("link", { name: "Editar no FPOne Admin" })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);

  await page.goto("/perfil");
  await expect(page.getByRole("heading", { level: 1, name: "Campo Teste" })).toBeVisible();
});
