import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./session";

/**
 * Tela de login (AD) e controle de acesso. Pré-requisito (ambiente local):
 *   docker compose run --rm -e E2E_ALLOW_SEED=true tools npx tsx scripts/e2e-seed.ts
 * O bind no AD não é exercitado aqui (sem AD no ambiente de teste): está coberto por
 * tests/ad-auth.test.ts com AD simulado. As sessões vêm do global-setup.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test("tela de login: usuário de rede e senha, sem CPF, PIN ou Microsoft", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[name="username"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "password");
  await expect(page.getByText(/CPF|PIN|Microsoft/)).toHaveCount(0);
  await expect(page.getByText("Dados fictícios · modo demo")).toHaveCount(0); // DEMO_MODE=false
  expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);
});

test("credenciais recusadas ficam no /login com mensagem genérica", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="username"]').fill("e2e.inexistente");
  await page.locator('input[name="password"]').fill("senha-errada");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText(/Usuário ou senha inválidos\.|Serviço de autenticação indisponível/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("sem sessão, qualquer rota vai para o login com callbackUrl", async ({ page }) => {
  await page.goto("/pessoas");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fpessoas/);
});

test("colaborador não vê o Admin e sai", async ({ page }) => {
  await signIn(page, "E2E002");
  await expect(page.getByRole("link", { name: /FPOne Admin/ })).toHaveCount(0);

  await page.goto("/admin/colaboradores");
  await expect(page.getByRole("heading", { name: "Acesso não permitido" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: /^Perfil de / }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("gestora de RH acessa Colaboradores (axe sem violações)", async ({ page }) => {
  await signIn(page, "E2E003");
  await page.getByRole("link", { name: /FPOne Admin/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "FPOne Admin" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Colaboradores" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Colaboradores" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Carga de colaboradores (CSV)" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test("CSV com erro não grava nada e oferece o relatório", async ({ page }) => {
  await signIn(page, "E2E003");
  await page.goto("/admin/colaboradores");
  const csv = "matricula;nome;unidade;departamento;cargo;cpf;status\nE2E999;Teste;Sede;TI;Dev;123.456.789-00;ativo\n";
  await page.getByLabel("Arquivo CSV (até 5 MB)").setInputFiles({ name: "carga.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Importar" }).click();
  await expect(page.getByText("Nada foi gravado: 1 problema(s) no arquivo.")).toBeVisible();
  await expect(page.getByText(/cpf: CPF inválido/)).toBeVisible();
  await expect(page.getByText("123.456.789-00")).toHaveCount(0);
});
