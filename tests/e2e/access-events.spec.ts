import { test, expect, type Page } from "@playwright/test";

// Credentials from supabase/seed.sql -- keep in sync if that file changes.
const EMPLOYEE = { email: "employee@powergym.local", password: "devpassword123" };

async function login(page: Page, creds: typeof EMPLOYEE) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(creds.email);
  await page.getByLabel("Contraseña").fill(creds.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/dashboard");
}

test("the audit log has a way back to the kiosk and no settings form", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/access/events");
  await expect(page.getByRole("heading", { name: "Intentos de acceso" })).toBeVisible();
  await expect(page.getByLabel("Umbral de similitud")).toHaveCount(0);

  await page.getByRole("link", { name: /Control de acceso/ }).first().click();
  await expect(page).toHaveURL(/\/access$/);
});

test("the filters narrow the log through the URL and can be cleared", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/access/events");

  await page.getByRole("radio", { name: "Denegados" }).click();
  await expect(page).toHaveURL(/[?&]result=denied/);

  await page.getByLabel("Buscar cliente").fill("zzz-nadie-se-llama-asi");
  await expect(page).toHaveURL(/[?&]q=zzz-nadie-se-llama-asi/);
  await expect(page.getByText("Todavía no hay intentos de acceso")).toBeVisible();

  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect(page).not.toHaveURL(/result=|q=/);
  await expect(page.getByLabel("Buscar cliente")).toHaveValue("");
});
