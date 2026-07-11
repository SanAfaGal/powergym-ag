import { test, expect } from "@playwright/test";

// Credentials from supabase/seed.sql -- keep in sync if that file changes.
const ADMIN = { email: "admin@powergym.local", password: "devpassword123" };
const EMPLOYEE = {
  email: "employee@powergym.local",
  password: "devpassword123",
};

async function login(page: import("@playwright/test").Page, creds: typeof ADMIN) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(creds.email);
  await page.getByLabel("Contraseña").fill(creds.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/dashboard");
}

test("employee sees plans but no mutation controls", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/plans");

  await expect(page.getByRole("button", { name: "Nuevo plan" })).toHaveCount(0);

  await page.getByRole("link", { name: "Plan Mensual" }).click();
  await expect(page).toHaveURL(/\/plans\/[0-9a-f-]+$/);
  await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Programar precio" })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Desactivar" })).toHaveCount(
    0
  );
});

test("employee is redirected away from /plans/new", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/plans/new");
  await expect(page).toHaveURL(/\/plans$/);
});

test("admin can create a plan end-to-end", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/plans/new");

  const planName = `E2E Plan ${Date.now()}`;
  await page.getByLabel("Nombre").fill(planName);
  await page.getByLabel("Duración").fill("1");
  await page.getByLabel("Precio inicial (COP)").fill("55000");
  await page.getByRole("button", { name: "Crear plan" }).click();

  await page.waitForURL(/\/plans\/[0-9a-f-]+$/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: planName })).toBeVisible();
  await expect(page.getByText("$55.000 COP")).toBeVisible();
});
