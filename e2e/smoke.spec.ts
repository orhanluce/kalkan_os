import { test, expect } from "@playwright/test";

test("home page boots and renders the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});
