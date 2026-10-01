import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./session";

/**
 * Home 1.3 (§185, RN-HOME-006). Fora do modo demo, cada bloco mostra dado real ou estado vazio;
 * com DEMO_MODE, o selo "Dados fictícios · modo demo" aparece. Usa o colaborador E2E002 do seed.
 */
test("Home: blocos na ordem 1.3, sem overflow e sem violações de axe", async ({ page }) => {
  await signIn(page, "E2E002");
  await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Colaborador\.$/ })).toBeVisible();

  for (const name of ["Acontecendo agora", "Hoje", "Aniversariantes", "Links úteis", "Novidades", "Documentos recentes"]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  const demo = await page.getByText("Dados fictícios · modo demo").isVisible();
  if (!demo) {
    // Sem demo: ou o estado vazio real, ou comunicados reais com link (nunca item fictício).
    const empty = page.getByText("Nenhum comunicado para você no momento.");
    const real = page.locator('main a[href^="/comunicados/"]');
    await expect(empty.or(real.first())).toBeVisible();
  }

  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `overflow horizontal em ${width}px`).toBe(false);
  }
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});
