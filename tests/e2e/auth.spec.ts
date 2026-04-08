/**
 * E2E — Authentication flows
 * Requires: app running on http://localhost:5000 (playwright.config.ts handles this)
 */
import { test, expect, Page } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => `e2e_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

async function register(page: Page, username: string, password = "Secure123!") {
  await page.goto("/register");
  await page.fill('[data-testid="input-username"]', username);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

async function login(page: Page, username: string, password = "Secure123!") {
  await page.goto("/login");
  await page.fill('[data-testid="input-username"]', username);
  await page.fill('[data-testid="input-password"]', password);
  await page.click('[data-testid="button-login"]');
}

// ─── Landing page ─────────────────────────────────────────────────────────────

test("unauthenticated: / shows landing page with TimeTrakr branding", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/TimeTrakr/i);
  await expect(page.locator("h1")).toBeVisible();
});

test("landing CTA 'Start for Free' navigates to /register", async ({ page }) => {
  await page.goto("/");
  await page.click("text=Start for Free");
  await expect(page).toHaveURL(/\/register/);
});

test("landing nav 'Sign In' navigates to /login", async ({ page }) => {
  await page.goto("/");
  await page.click("text=Sign In");
  await expect(page).toHaveURL(/\/login/);
});

// ─── Register ─────────────────────────────────────────────────────────────────

test("register: new user can create account and land on dashboard", async ({ page }) => {
  const username = uid();
  await register(page, username);
  await expect(page).toHaveURL("/dashboard");
  // Dashboard should show after register
  await expect(page.locator('[data-testid="button-log-hours"]')).toBeVisible({ timeout: 5000 });
});

test("register: duplicate username shows error message", async ({ page }) => {
  const username = uid();
  await register(page, username);
  // Logout
  await page.goto("/");
  await page.goto("/login");
  // Try registering again
  await register(page, username);
  await expect(page.locator("text=/already|exists|taken/i")).toBeVisible();
});

test("register: password strength meter appears on input", async ({ page }) => {
  await page.goto("/register");
  await page.fill('input[type="password"]', "weak");
  await expect(page.locator("text=/Weak|Fair|Good|Strong/")).toBeVisible();
});

test("register: brand shows 'TimeTrakr' not 'TimeFlow'", async ({ page }) => {
  await page.goto("/register");
  await expect(page.locator("text=TimeTrakr").first()).toBeVisible();
  await expect(page.locator("text=TimeFlow")).not.toBeVisible();
});

// ─── Login ────────────────────────────────────────────────────────────────────

test("login: valid credentials → dashboard", async ({ page }) => {
  const username = uid();
  // Register first
  await page.request.post("/api/register", {
    data: { username, password: "Secure123!" },
  });
  await login(page, username);
  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator('[data-testid="button-log-hours"]')).toBeVisible({ timeout: 5000 });
});

test("login: wrong password shows error", async ({ page }) => {
  const username = uid();
  await page.request.post("/api/register", { data: { username, password: "Secure123!" } });
  await login(page, username, "wrongpassword");
  await expect(page.locator("text=/invalid|incorrect|wrong|failed/i")).toBeVisible();
});

test("login: 'Forgot password?' link is visible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("text=Forgot password?")).toBeVisible();
});

test("login: brand shows 'TimeTrakr' not 'TimeFlow'", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("text=TimeTrakr").first()).toBeVisible();
  await expect(page.locator("text=TimeFlow")).not.toBeVisible();
});

// ─── Auth redirects ───────────────────────────────────────────────────────────

test("authenticated user visiting /login is redirected to /", async ({ page }) => {
  const username = uid();
  await page.request.post("/api/register", { data: { username, password: "Secure123!" } });
  await login(page, username);
  await page.goto("/login");
  await expect(page).toHaveURL("/dashboard");
});

test("unauthenticated user visiting /history is redirected to /login", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/login/);
});

// ─── Session persistence ──────────────────────────────────────────────────────

test("session persists across page reloads", async ({ page }) => {
  const username = uid();
  await page.request.post("/api/register", { data: { username, password: "Secure123!" } });
  await login(page, username);
  await page.reload();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator('[data-testid="button-log-hours"]')).toBeVisible({ timeout: 5000 });
});
