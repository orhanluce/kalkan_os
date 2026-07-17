import { defineConfig, devices } from "@playwright/test";
import { loadEnvLocal } from "./scripts/env";

// .env.local Next.js dev server'a (webServer altında) otomatik yüklenir,
// ama Playwright'ın kendi test process'ine YÜKLENMEZ — testler
// process.env.E2E_USER_EMAIL/PASSWORD okuyabilsin diye burada elle
// yapıyoruz (bkz. e2e/helpers.ts).
for (const [key, value] of Object.entries(loadEnvLocal())) {
  process.env[key] ??= value;
}

export default defineConfig({
  testDir: "./e2e",
  // fullyParallel: false + workers: 1: testler ayrı bir e2e kiracısını
  // paylaşıyor (bkz. scripts/setup-e2e-fixtures.ts). Paralel koşu, bir
  // testin bıraktığı DB durumunun başka bir testin ortasında değişmesine
  // yol açabilir — sıralı koşu bu sınıfı flaky testi baştan eler.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
