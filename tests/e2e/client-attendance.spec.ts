import { test, expect } from "@playwright/test";

// Credentials from supabase/seed.sql -- keep in sync if that file changes.
test("the client page shows an attendance summary", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("admin@powergym.local");
  await page.getByLabel("Contraseña").fill("devpassword123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/clients");
  const search = page
    .getByPlaceholder("Buscar por nombre, alias, documento o email...")
    .first();
  await search.waitFor();
  await search.fill("Maria Gomez");
  await page.waitForURL(/[?&]q=Maria(\+|%20)Gomez/);
  await page.getByRole("link", { name: "Maria Gomez" }).click();

  await expect(page.getByText("Asistencia", { exact: true })).toBeVisible();
  await expect(page.getByText(/días? este mes/)).toBeVisible();
  await expect(page.getByText(/días? en 12 meses/)).toBeVisible();
});
