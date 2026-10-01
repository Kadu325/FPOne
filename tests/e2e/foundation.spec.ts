import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WIDTHS = [320, 375, 390, 768, 1024, 1280, 1440, 1920];

test("sem sessão, a página inicial leva ao login (RN-AUTH-001)", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  // Tela de login AD: o h1 (só para leitores de tela) é o nome do produto.
  await expect(page.getByRole("heading", { level: 1, name: "FPOne Intranet" })).toBeVisible();
});

test("login sem violações WCAG 2.2 AA (axe)", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

for (const width of WIDTHS) {
  test(`login sem overflow horizontal em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/login");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("GET /api/health responde com os três checks, sem sessão", async ({ request }) => {
  const res = await request.get("/api/health");
  const body = (await res.json()) as { checks: Record<string, string> };
  expect(Object.keys(body.checks).sort()).toEqual(["db", "storage", "web"]);
});
