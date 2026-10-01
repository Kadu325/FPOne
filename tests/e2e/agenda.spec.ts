import { expect, test } from "@playwright/test";
import { signIn } from "./session";

/** Agenda (§160): evento segmentado, publicado, cancelado com histórico (RN-EVT-004). */
const TITLE = `Reunião E2E ${Date.now() % 100000}`;


/** Valor de datetime-local no horário da Bahia (UTC−3), deslocado em horas a partir de agora. */
function localInput(offsetHours: number): string {
  const d = new Date(Date.now() + offsetHours * 3_600_000 - 3 * 3_600_000);
  return d.toISOString().slice(0, 16);
}

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "fluxo administrativo no desktop");

test("Comunicação cria, recusa datas invertidas, publica e cancela evento da Sede", async ({ page }) => {
  await signIn(page, "E2E004");
  await page.goto("/admin/agenda");
  await page.getByRole("button", { name: "Novo evento" }).click();
  const form = page.getByRole("form", { name: "Novo evento" });
  await form.getByLabel("Título").fill(TITLE);
  await form.getByLabel("Início").fill(localInput(48));
  await form.getByLabel("Término").fill(localInput(47));
  await form.getByLabel("Local").fill("Auditório");
  await page.getByLabel("Unidades e departamentos").check();
  await page.getByRole("group", { name: "Unidades" }).getByLabel("Sede").check();
  await page.getByRole("button", { name: "Salvar evento" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("término do evento não pode ser anterior");
  await form.getByLabel("Término").fill(localInput(49));
  await page.getByRole("button", { name: "Salvar evento" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Evento salvo como rascunho.");
  await page.getByRole("button", { name: `Publicar ${TITLE}` }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Evento publicado na agenda.");
});

test("Sede vê o evento; outra unidade não; cancelado continua visível com indicação", async ({ browser }) => {
  const sede = await browser.newPage();
  await signIn(sede, "E2E002");
  await sede.goto("/agenda");
  await expect(sede.getByRole("heading", { name: TITLE })).toBeVisible();

  const norte = await browser.newPage();
  await signIn(norte, "E2E005");
  await norte.goto("/agenda");
  await expect(norte.getByText(TITLE)).toHaveCount(0);

  const admin = await browser.newPage();
  await signIn(admin, "E2E004");
  await admin.goto("/admin/agenda");
  admin.once("dialog", (d) => d.accept("Mudança de data"));
  await admin.getByRole("button", { name: `Cancelar evento ${TITLE}` }).click();
  await expect(admin.getByRole("main").getByRole("status")).toContainText("Evento cancelado");

  await sede.reload();
  const card = sede.getByRole("article").filter({ hasText: TITLE });
  await expect(card.getByText("Cancelado")).toBeVisible();
  await expect(card.getByText("Motivo: Mudança de data")).toBeVisible();
});
