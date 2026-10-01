import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./session";

/**
 * Indicadores (§164, §187) e Auditoria (§168). Indicadores só com analytics.read; auditoria só
 * com audit.read (ADMIN). Usa E2E006 (ADMIN) e dados criados pelos outros specs.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "telas administrativas no desktop");

test("Comunicação vê indicadores com período e população; colaborador não", async ({ browser }) => {
  const comm = await (await browser.newContext()).newPage();
  await signIn(comm, "E2E004");
  await comm.goto("/indicadores?periodo=7");
  await expect(comm.getByRole("heading", { level: 1, name: "Indicadores" })).toBeVisible();
  await expect(comm.getByText(/Período: \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  await expect(comm.getByText(/população-base: \d+ colaboradores ativos/)).toBeVisible();
  // Houve acesso hoje (esta própria página): DAU nunca pode ser "sem dados".
  await expect(comm.getByText("DAU (hoje)").locator("..").getByText("Ainda não há dados suficientes")).toHaveCount(0);
  expect((await new AxeBuilder({ page: comm }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);

  const employee = await (await browser.newContext()).newPage();
  await signIn(employee, "E2E002");
  await employee.goto("/indicadores");
  await expect(employee.getByRole("heading", { name: "Acesso não permitido" })).toBeVisible();
});

test("ADMIN filtra a auditoria e exporta CSV; Comunicação não acessa", async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, "E2E006");
  await admin.goto("/admin/auditoria");
  await admin.getByLabel("Ação", { exact: true }).selectOption({ label: "Documento baixado" });
  await admin.getByRole("button", { name: "Filtrar" }).click();
  await expect(admin).toHaveURL(/action=DOCUMENT_DOWNLOADED/);
  const rows = admin.getByRole("table").getByRole("row");
  await expect(rows.nth(1)).toContainText("Documento baixado");
  expect((await new AxeBuilder({ page: admin }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);

  const csv = await admin.request.get("/api/admin/auditoria/export?action=DOCUMENT_DOWNLOADED");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text).toContain("id;data_hora;acao;codigo;entidade;id_entidade;autor;ip;detalhes");
  expect(text).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}|"cpf/i);

  await admin.goto("/admin/auditoria?action=AUDIT_EXPORTED");
  await expect(admin.getByRole("table").getByRole("row").nth(1)).toContainText("Auditoria exportada");

  const comm = await (await browser.newContext()).newPage();
  await signIn(comm, "E2E004");
  await comm.goto("/admin/auditoria");
  await expect(comm.getByRole("heading", { name: "Acesso não permitido" })).toBeVisible();
  expect((await comm.request.get("/api/admin/auditoria/export")).status()).toBe(403);
});
