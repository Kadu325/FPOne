import { expect, test } from "@playwright/test";
import { signIn } from "./session";

/**
 * Documentos (§161): upload validado pelo conteúdo (RN-DOC-008), publicação segmentada, nova versão
 * substitui a anterior sem apagá-la (RN-DOC-002/004) e download só com permissão (RN-DOC-005/007).
 */
const TITLE = `POP E2E ${Date.now() % 100000}`;
const pdf = (text: string) => Buffer.from(`%PDF-1.4\n% ${text}\n%%EOF\n`, "utf8");
let docUrl = "";

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "fluxo administrativo no desktop");

test("Comunicação cria documento, recusa arquivo falso, publica e envia nova versão", async ({ page }) => {
  await signIn(page, "E2E004");
  await page.goto("/admin/documentos/novo");
  await page.getByLabel("Título").fill(TITLE);
  await page.getByLabel("Categoria").selectOption("POPs");
  await page.getByLabel("Unidades e departamentos").check();
  await page.getByRole("group", { name: "Unidades" }).getByLabel("Sede").check();
  await page.getByRole("button", { name: "Criar documento" }).click();
  await expect(page).toHaveURL(/\/admin\/documentos\/[0-9a-f-]{36}$/);
  docUrl = page.url();

  await page.getByLabel("Selecionar arquivo").setInputFiles({ name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>não é pdf</html>") });
  await page.getByRole("button", { name: "Enviar arquivo" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("não corresponde à extensão");

  await page.getByLabel("Selecionar arquivo").setInputFiles({ name: "POP v1.pdf", mimeType: "application/pdf", buffer: pdf("versao 1") });
  await page.getByRole("button", { name: "Enviar arquivo" }).click();
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "Versão 1 enviada." })).toBeVisible();
  await page.getByRole("button", { name: "Publicar documento" }).click();
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "Documento publicado." })).toBeVisible();

  await page.getByLabel("Selecionar arquivo").setInputFiles({ name: "POP v2.pdf", mimeType: "application/pdf", buffer: pdf("versao 2") });
  await page.getByRole("button", { name: "Enviar arquivo" }).click();
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "Versão 2 enviada." })).toBeVisible();
  const versions = page.getByRole("region", { name: "Versões" });
  await expect(versions.getByText(/v2 · POP v2\.pdf .* Publicado/)).toBeVisible();
  await expect(versions.getByText(/v1 · POP v1\.pdf .* Substituída/)).toBeVisible();
});

test("colaborador da Sede baixa a versão vigente; outra unidade recebe 404", async ({ browser }) => {
  const id = docUrl.split("/").pop();
  const sede = await browser.newPage();
  await signIn(sede, "E2E002");
  await sede.goto("/documentos");
  await expect(sede.getByRole("link", { name: `Baixar ${TITLE}` })).toBeVisible();
  const res = await sede.request.get(`/api/documentos/${id}/download`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("attachment");
  expect(await res.text()).toContain("versao 2");

  const norte = await browser.newPage();
  await signIn(norte, "E2E005");
  await norte.goto("/documentos");
  await expect(norte.getByRole("link", { name: `Baixar ${TITLE}` })).toHaveCount(0);
  const denied = await norte.request.get(`/api/documentos/${id}/download`, { maxRedirects: 0 });
  expect(denied.status()).toBe(404);
});
