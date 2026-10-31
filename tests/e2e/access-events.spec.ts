import { test, expect, type Page } from "@playwright/test";

// Credentials from supabase/seed.sql -- keep in sync if that file changes.
const ADMIN = { email: "admin@powergym.local", password: "devpassword123" };
const EMPLOYEE = { email: "employee@powergym.local", password: "devpassword123" };

async function login(page: Page, creds: typeof ADMIN) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(creds.email);
  await page.getByLabel("Contraseña").fill(creds.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/dashboard");
}

// The threshold lives in a single settings row shared by every test run.
test.describe.configure({ mode: "serial" });

test("an employee sees the audit log but not the settings form", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/access/events");
  await expect(page.getByRole("heading", { name: "Intentos de acceso" })).toBeVisible();
  await expect(page.getByLabel("Umbral de similitud")).toHaveCount(0);
});

test("an admin can change the similarity threshold and it persists", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/access/events");
  const threshold = page.getByLabel("Umbral de similitud");
  await expect(threshold).toHaveValue("0.5");

  await threshold.fill("0.6");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText("Configuración guardada")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Umbral de similitud")).toHaveValue("0.6");

  // restore the default for the next run
  await page.getByLabel("Umbral de similitud").fill("0.5");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText("Configuración guardada")).toBeVisible();
});

test("a threshold outside 0 to 1 is rejected", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/access/events");
  await page.getByLabel("Umbral de similitud").fill("1.5");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText(/entre 0 y 1/)).toBeVisible();
});
