import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // Um login por usuário para a suíte toda (RN-AUTH-008 conta também logins bem-sucedidos).
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    // Em localhost o Caddy usa a própria CA interna; em qualquer outro host o certificado é validado.
    ignoreHTTPSErrors: new URL(baseURL).hostname === "localhost",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // O fluxo de autenticação consome o estado do seed; roda uma vez só (desktop).
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /auth\.spec\.ts$/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
