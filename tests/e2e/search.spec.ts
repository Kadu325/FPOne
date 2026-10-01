import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./session";

/**
 * Busca Global (§163). Depende dos dados criados por people/publications/documents.spec na mesma
 * execução (responsabilidade "Escrituração Fiscal"; comunicado e documento só para a Sede).
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "busca pelo topbar no desktop");

test("pergunta vira assunto, sem acento/caixa, com Pessoas primeiro e sem violações de axe", async ({ page }) => {
  await signIn(page, "E2E002");
  await page.getByLabel("Buscar na FPOne Intranet").fill("quem é responsável pela ESCRITURAÇÃO?");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/busca\?q=/);
  await expect(page.getByRole("main").getByRole("status")).toContainText("para “escrituracao”");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Pessoas");
  await expect(page.getByRole("link", { name: "Colaborador Teste", exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);
});

test("resultados respeitam o público: Sede vê documento e comunicado E2E; outra unidade não", async ({ browser }) => {
  const sede = await browser.newPage();
  await signIn(sede, "E2E002");
  await sede.goto("/busca?q=E2E");
  await expect(sede.getByRole("heading", { name: "Documentos" })).toBeVisible();
  await expect(sede.getByRole("heading", { name: "Comunicados e novidades" })).toBeVisible();

  const norte = await browser.newPage();
  await signIn(norte, "E2E005");
  await norte.goto("/busca?q=POP E2E");
  await expect(norte.getByRole("heading", { name: "Documentos" })).toHaveCount(0);
  await norte.goto("/busca?q=Comunicado E2E");
  await expect(norte.getByRole("heading", { name: "Comunicados e novidades" })).toHaveCount(0);
});

test("consulta curta pede mais letras; sem resultado mostra sugestões", async ({ page }) => {
  await signIn(page, "E2E002");
  await page.goto("/busca?q=a");
  await expect(page.getByText("Digite ao menos 2 letras.")).toBeVisible();
  await page.goto("/busca?q=zzqxwvk");
  await expect(page.getByText("Nada encontrado com esses termos.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Fiscal" })).toBeVisible();
});
