const { test, expect } = require("@playwright/test");

test("backend health endpoint is available", async ({ request }) => {
  const response = await request.get("http://localhost:5000/health");

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});

test("user app landing page opens and reaches auth screen", async ({ page }) => {
  await page.goto("http://localhost:3000/");

  await expect(page.getByRole("heading", { name: /PROFESSIONAL HOME SERVICES/i })).toBeVisible();
  await page.getByRole("link", { name: "BOOK NOW" }).first().click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: "SIGN IN TO CONTINUE" })).toBeVisible();
});

test("worker app landing page opens and reaches login screen", async ({ page }) => {
  await page.goto("http://localhost:3001/");

  await expect(page.getByRole("heading", { name: "BUILD A STABLE" })).toBeVisible();
  await page.getByRole("link", { name: "EMPLOYEE LOGIN" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "EMPLOYEE SIGN IN" })).toBeVisible();
});

test("admin panel shows login form", async ({ page }) => {
  await page.goto("http://localhost:3002/");

  await expect(page.getByRole("heading", { name: "Tasko Admin Login" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Enter password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
