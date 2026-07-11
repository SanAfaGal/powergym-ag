import { test, expect } from "@playwright/test";

// Credentials from supabase/seed.sql -- keep in sync if that file changes.
const ADMIN = { email: "admin@powergym.local", password: "devpassword123" };
const INACTIVE = {
  email: "inactive@powergym.local",
  password: "devpassword123",
};

test("valid login redirects to the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(ADMIN.email);
  await page.getByLabel("Contraseña").fill(ADMIN.password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText(/Bienvenido, Admin Seed/)).toBeVisible();
});

test("invalid credentials show an inline error and stay on /login", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(ADMIN.email);
  await page.getByLabel("Contraseña").fill("wrong-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("an unauthenticated visit to /dashboard redirects to /login", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("a deactivated account is blocked at login, even with the right password", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(INACTIVE.email);
  await page.getByLabel("Contraseña").fill(INACTIVE.password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.getByText(/cuenta fue desactivada/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  // and the blocked account never got a session in the first place
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
