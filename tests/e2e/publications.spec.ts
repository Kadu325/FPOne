import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./session";

/**
 * Fase 5 (§80): Comunicação cria comunicado segmentado para a unidade "Sede", pré-visualiza e
 * publica; colaborador da Sede confirma ciência; colaborador de outra unidade não vê nem pela URL.
 * Pré-requisito: scripts/e2e-seed.ts (E2E002 Sede, E2E004 Comunicação, E2E005 Fazenda Norte).
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const TITLE = `Comunicado E2E ${Date.now()}`;


test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "fluxo administrativo no desktop");

let publicationUrl = "";

test("Comunicação cria, pré-visualiza e publica comunicado segmentado", async ({ page }) => {
  await signIn(page, "E2E004");
  await page.goto("/admin/publicacoes/nova");
  await page.getByRole("textbox", { name: "Título" }).fill(TITLE);
  await page.getByLabel("Resumo").fill("Resumo do teste automatizado.");
  await page.getByRole("textbox", { name: "Conteúdo" }).click();
  await page.keyboard.type("Texto obrigatório para confirmar ciência.");
  await page.getByLabel("Unidades e departamentos").check();
  await page.getByRole("group", { name: "Unidades" }).getByLabel("Sede").check();
  await page.getByLabel(/Exigir confirmação de leitura/).check();
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page).toHaveURL(/\/admin\/publicacoes\/[0-9a-f-]{36}$/);
  publicationUrl = page.url();

  const publish = page.getByRole("button", { name: "Publicar agora" });
  await expect(publish).toBeDisabled();
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  await expect(page.getByRole("heading", { name: "Pré-visualização" })).toBeVisible();
  await page.getByRole("button", { name: "Mobile" }).click();
  expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);
  await publish.click();
  await expect(page.getByRole("status").filter({ hasText: "Publicado." })).toBeVisible();
});

test("colaborador da Sede vê o comunicado e confirma ciência uma única vez", async ({ page }) => {
  await signIn(page, "E2E002");
  await expect(page.getByRole("link", { name: TITLE }).first()).toBeVisible();
  await page.goto("/comunicados");
  await page.getByRole("link", { name: TITLE }).click();
  await page.getByRole("button", { name: "Li e estou ciente" }).click();
  await expect(page.getByText("Ciência registrada.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Li e estou ciente" })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);
});

test("colaborador de outra unidade não vê o comunicado nem pela URL (RN-CORE-002)", async ({ page }) => {
  await signIn(page, "E2E005");
  await page.goto("/comunicados");
  await expect(page.getByRole("link", { name: TITLE })).toHaveCount(0);
  const id = publicationUrl.split("/").pop();
  await page.goto(`/comunicados/${id}`);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await page.goto("/admin/publicacoes");
  await expect(page.getByRole("heading", { name: "Acesso não permitido" })).toBeVisible();
});
