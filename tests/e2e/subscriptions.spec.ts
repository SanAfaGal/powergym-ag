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

test("admin can enroll a client, record a full payment, and see it become active", async ({
  page,
}) => {
  await login(page, ADMIN);

  await page.goto("/clients");
  await page
    .getByPlaceholder("Buscar por nombre, alias, documento o email...")
    .waitFor();
  await page.getByRole("link", { name: "Maria Gomez" }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/);

  await page.getByRole("button", { name: "Nueva suscripción" }).click();

  // Base UI's Select renders its trigger with role="combobox" and its
  // options with role="option" (verified against
  // node_modules/@base-ui/react/select's source), so getByRole works here
  // same as it would for a native <select> -- no special-casing needed.
  // The trigger is reachable via getByLabel because FormLabel's `htmlFor`
  // points at the id FormControl's Slot forwards onto SelectTrigger.
  await page.getByLabel("Plan").click();
  await page.getByRole("option", { name: /Plan Mensual/ }).click();

  // EnrollDialog now defaults "Fecha de inicio" to the Bogota-local date
  // (fixed after this test originally caught it defaulting via UTC
  // instead). Setting it explicitly here anyway keeps this assertion's
  // outcome independent of that default regardless of wall-clock time.
  const bogotaToday = await page.evaluate(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  );
  await page.getByLabel("Fecha de inicio").fill(bogotaToday);

  await page.getByRole("button", { name: "Enrolar" }).click();

  await expect(page.getByText("Pendiente de pago")).toBeVisible();

  await page.getByRole("button", { name: "Registrar pago" }).click();
  await page.getByLabel("Método de pago").click();
  await page.getByRole("option", { name: "Efectivo" }).click();
  // "Efectivo" (cash) doesn't require a bank account, so no extra field
  // should appear before we can submit.
  await expect(page.getByLabel("Cuenta que recibe")).toHaveCount(0);
  await page.getByRole("button", { name: "Registrar pago" }).click();

  await expect(page.getByText("Activa")).toBeVisible();
});

test("employee is redirected away from /bank-accounts", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/bank-accounts");
  await expect(page).toHaveURL(/\/dashboard$/);
});
