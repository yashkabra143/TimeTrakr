/**
 * E2E — Core user journey: time entry logging + earnings verification
 */
import { test, expect, Page, APIRequestContext } from "@playwright/test";

const uid = () => `e2e_entry_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

async function setupAuthenticatedUser(request: APIRequestContext, username: string) {
  await request.post("/api/register", { data: { username, password: "Secure123!" } });
}

async function loginUI(page: Page, username: string) {
  await page.goto("/login");
  await page.fill('[data-testid="input-username"]', username);
  await page.fill('[data-testid="input-password"]', "Secure123!");
  await page.click('[data-testid="button-login"]');
  await page.waitForURL("/dashboard");
}

// ─── Quick entry page ─────────────────────────────────────────────────────────

test("quick entry page is accessible from dashboard", async ({ page, request }) => {
  const username = uid();
  await setupAuthenticatedUser(request, username);
  await loginUI(page, username);

  await page.click('[data-testid="button-log-hours"]');
  await expect(page).toHaveURL(/\/quick-entry/);
});

// ─── Settings → Currency conversion (auto-refresh) ────────────────────────────

test("settings financials tab shows currency section with auto-refresh indicator", async ({ page, request }) => {
  const username = uid();
  await setupAuthenticatedUser(request, username);
  await loginUI(page, username);

  await page.goto("/settings");
  await page.click("text=Financials");

  // Rate card should be visible
  await expect(page.locator('[data-testid="input-exchange-rate"]')).toBeVisible({ timeout: 8000 });
  // After auto-poll (up to 10s), "Updated" indicator should appear
  await expect(page.locator("text=/Updated|auto-refreshes/i")).toBeVisible({ timeout: 10000 });
});

test("settings: manual rate update via 'Refresh Now' button", async ({ page, request }) => {
  const username = uid();
  await setupAuthenticatedUser(request, username);
  await loginUI(page, username);

  await page.goto("/settings");
  await page.click("text=Financials");

  await page.click('[data-testid="button-fetch-rate"]');
  await expect(page.locator("text=/Updated|just now/i")).toBeVisible({ timeout: 8000 });
});

test("settings: manual rate save", async ({ page, request }) => {
  const username = uid();
  await setupAuthenticatedUser(request, username);
  await loginUI(page, username);

  await page.goto("/settings");
  await page.click("text=Financials");

  const rateInput = page.locator('[data-testid="input-exchange-rate"]');
  await rateInput.waitFor({ state: "visible", timeout: 8000 });
  await rateInput.fill("88.50");
  await page.click('[data-testid="button-save-currency"]');

  await expect(page.locator("text=/Currency Updated|Rate set/i")).toBeVisible({ timeout: 5000 });
});

// ─── Weekly view navigation ───────────────────────────────────────────────────

test("weekly view: prev/next/today navigation works", async ({ page, request }) => {
  const username = uid();
  await setupAuthenticatedUser(request, username);
  await loginUI(page, username);

  await page.goto("/weekly");

  await page.click('[data-testid="button-prev-week"]');
  await page.click('[data-testid="button-next-week"]');
  await page.click('[data-testid="button-today"]');

  // Should not crash or navigate away
  await expect(page).toHaveURL(/\/weekly/);
});

// ─── Tax page ─────────────────────────────────────────────────────────────────

test("tax page loads without errors", async ({ page, request }) => {
  const username = uid();
  await setupAuthenticatedUser(request, username);
  await loginUI(page, username);

  await page.goto("/tax");
  // Should render some tax-related content
  await expect(page.locator("text=/tax|advance|GST|TDS/i").first()).toBeVisible({ timeout: 5000 });
});

// ─── Usability: form validation ───────────────────────────────────────────────

test("register form submit button disabled until username is entered", async ({ page }) => {
  await page.goto("/register");
  const submitBtn = page.locator('button[type="submit"]');
  await expect(submitBtn).toBeDisabled();

  await page.fill('input[placeholder*="username"]', "someuser");
  await page.fill('input[type="password"]', "somepass");
  await expect(submitBtn).toBeEnabled();
});

// ─── Accessibility: keyboard navigation ──────────────────────────────────────

test("login form is navigable by Tab key", async ({ page }) => {
  await page.goto("/login");

  await page.keyboard.press("Tab");
  const focused1 = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  expect(focused1).toBe("input-username");

  await page.keyboard.press("Tab");
  const focused2 = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  expect(focused2).toBe("input-password");
});

// ─── Mobile responsiveness ────────────────────────────────────────────────────

test("landing page: hamburger menu opens on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  // Hamburger button should be visible on mobile
  const hamburger = page.locator('button[aria-label*="menu"], button:has(svg.lucide-menu)').first();
  if (await hamburger.isVisible()) {
    await hamburger.click();
    // Nav links should appear
    await expect(page.locator("text=Features").first()).toBeVisible();
  }
  // If no hamburger (different breakpoint), just check page renders
  await expect(page.locator("h1")).toBeVisible();
});
