import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";
import { authFile } from "./session";

/**
 * AppShell (§83–93, §109–121, §185). Usa a sessão do colaborador E2E002 salva no global-setup
 * (sem novo login: o limite de 20 tentativas por IP da RN-AUTH-008 vale também para o E2E).
 * Pré-requisito: docker compose run --rm -e E2E_ALLOW_SEED=true tools npx tsx scripts/e2e-seed.ts
 */
const WIDTHS = [320, 375, 768, 1024, 1280, 1920];
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

const test = base.extend({ storageState: authFile("E2E002") });

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Colaborador.$/ })).toBeVisible();
}

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "só desktop");

  test("sidebar com o menu oficial, sem Admin para colaborador, e topbar só com utilidades", async ({ page }) => {
    await login(page);
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Meu FPOne" })).toHaveAttribute("aria-current", "page");
    for (const label of ["Comunicados", "Novidades", "Aniversariantes", "Meu Perfil", "Colaboradores", "Agenda / Eventos", "Documentos", "Links úteis", "Busca Global"]) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("FPOne Admin")).toHaveCount(0);
    // Indicadores só com analytics.read (decisão da Fase 7).
    await expect(nav.getByText("Indicadores", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Notificações" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Perfil de / })).toBeVisible();
    await expect(page.getByLabel("Buscar na FPOne Intranet")).toBeEnabled();
  });

  test("recolher persiste após recarregar e mostra tooltip", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Recolher menu lateral" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Expandir menu lateral" })).toBeVisible();
    const home = page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Meu FPOne" });
    await home.hover();
    await expect(home.locator("[aria-hidden=true]", { hasText: "Meu FPOne" })).toBeVisible();
    await page.getByRole("button", { name: "Expandir menu lateral" }).click();
    await expect(page.getByRole("button", { name: "Recolher menu lateral" })).toBeVisible();
  });

  test("notificações e perfil abrem e fecham com ESC", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Notificações" }).click();
    await expect(page.getByText("Você não tem notificações.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Você não tem notificações.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Notificações" })).toBeFocused();
  });

  test("Meu FPOne sem violações WCAG 2.2 AA (axe), expandido e recolhido", async ({ page }) => {
    await login(page);
    expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Recolher menu lateral" }).click();
    expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Expandir menu lateral" }).click();
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "só mobile");

  test("drawer abre, prende foco, fecha com ESC e pelo botão; barra inferior presente", async ({ page }) => {
    await login(page);
    const bottom = page.getByRole("navigation", { name: "Navegação rápida" });
    await expect(bottom.getByRole("link", { name: "Início" })).toBeVisible();
    await expect(bottom.getByText("Comunicados")).toBeVisible();
    await expect(bottom.getByText("Pessoas")).toBeVisible();
    await expect(bottom.getByText("Buscar")).toBeVisible();

    const open = page.getByRole("button", { name: "Abrir menu" });
    await open.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer.getByRole("link", { name: "Meu FPOne" })).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(open).toBeFocused();

    await open.click();
    await drawer.getByRole("button", { name: "Fechar menu" }).click();
    await expect(drawer).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

    await open.click();
    await drawer.getByRole("link", { name: "Meu FPOne" }).click();
    await expect(drawer).toBeHidden();
  });

  test("mobile sem violações WCAG 2.2 AA (axe), com o drawer aberto", async ({ page }) => {
    await login(page);
    expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);
  });
});

test("sem overflow horizontal no AppShell de 320px a 1920px", async ({ page, isMobile }) => {
  test.skip(isMobile, "larguras cobertas no desktop");
  await login(page);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
  }
});
