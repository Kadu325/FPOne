import { expect, test } from "@playwright/test";
import { signIn } from "./session";

/** Links úteis (§162): Comunicação cadastra link segmentado; só a unidade certa vê (RN-LNK-002). */
const LABEL = `Portal E2E ${Date.now() % 100000}`;


test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "fluxo administrativo no desktop");

test("Comunicação cria link só para a Fazenda Norte e recusa URL insegura", async ({ page }) => {
  await signIn(page, "E2E004");
  await page.goto("/admin/links");
  await page.getByRole("button", { name: "Novo link" }).click();
  await page.getByLabel("Nome").fill(LABEL);
  await page.getByLabel(/^Endereço/).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Salvar link" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("http://, https://");
  await page.getByLabel(/^Endereço/).fill("https://example.com/portal");
  await page.getByLabel("Unidades e departamentos").check();
  await page.getByRole("group", { name: "Unidades" }).getByLabel("Fazenda Norte").check();
  await page.getByRole("button", { name: "Salvar link" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Link criado.");
});

test("só a Fazenda Norte vê o link em Links úteis", async ({ browser }) => {
  const norte = await browser.newPage();
  await signIn(norte, "E2E005");
  // A Home mostra só os 6 primeiros na ordem configurada; a página lista todos.
  await norte.goto("/links");
  await expect(norte.getByRole("link", { name: new RegExp(LABEL) })).toBeVisible();
  const sede = await browser.newPage();
  await signIn(sede, "E2E002");
  await sede.goto("/links");
  await expect(sede.getByText(LABEL)).toHaveCount(0);
});
