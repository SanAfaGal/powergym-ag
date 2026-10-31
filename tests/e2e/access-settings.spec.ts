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

// The settings live in a single row shared by every test run.
test.describe.configure({ mode: "serial" });

test("an employee is redirected away from the settings page", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/access/settings");
  await expect(page).toHaveURL(/\/access$/);
});

test("an admin reaches the settings from the kiosk and can go back", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/access");
  await page.getByRole("button", { name: "Configuración" }).click();
  await expect(page).toHaveURL(/\/access\/settings$/);
  await page.getByRole("link", { name: /Control de acceso/ }).first().click();
  await expect(page).toHaveURL(/\/access$/);
});

test("an admin can change the threshold and the liveness challenges, and they persist", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto("/access/settings");
  // the challenge boxes are disabled while liveness is off; start from on
  await page.getByLabel("Exigir prueba de vida").check();

  const threshold = page.getByLabel("Umbral de similitud");
  await expect(threshold).toHaveValue("0.5");
  await threshold.fill("0.6");
  await page.getByLabel("Sonreír").uncheck();
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText("Configuración guardada")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Umbral de similitud")).toHaveValue("0.6");
  await expect(page.getByLabel("Sonreír")).not.toBeChecked();
  await expect(page.getByLabel("Parpadear")).toBeChecked();

  // restore the defaults for the next run
  await page.getByLabel("Umbral de similitud").fill("0.5");
  await page.getByLabel("Sonreír").check();
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText("Configuración guardada")).toBeVisible();
});

test("a threshold outside 0 to 1 is rejected", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/access/settings");
  await page.getByLabel("Umbral de similitud").fill("1.5");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText(/entre 0 y 1/).last()).toBeVisible();
});

test("liveness cannot be required with no challenge selected", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/access/settings");
  // the challenge boxes are disabled while liveness is off; start from on
  await page.getByLabel("Exigir prueba de vida").check();
  for (const name of ["Parpadear", "Abrir la boca", "Sonreír"]) {
    await page.getByLabel(name).uncheck();
  }
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText("Elegí al menos una prueba de vida")).toBeVisible();
});
