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
  // ClientFilters renders a desktop and a mobile toolbar unconditionally
  // (CSS hides whichever doesn't match the breakpoint), so this placeholder
  // matches two real <input> elements -- .first() is the desktop one, the
  // one actually visible at this project's Desktop Chrome viewport.
  const searchInput = page
    .getByPlaceholder("Buscar por nombre, alias, documento o email...")
    .first();
  await searchInput.waitFor();
  // The seeded client list has grown past one page (Task 9), and the
  // default sort is by subscription start date, so "Maria Gomez" isn't
  // guaranteed to be on page 1. Search for her by name instead of relying
  // on list position -- ClientFilters debounces the query 300ms before
  // pushing it as a `q` search param, so wait for that navigation to
  // settle before locating the now-filtered, guaranteed-single link.
  await searchInput.fill("Maria Gomez");
  await page.waitForURL(/[?&]q=Maria(\+|%20)Gomez/);
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
  // instead). Assert it explicitly here (via DatePicker's data-value, its
  // raw "yyyy-MM-dd" -- the visible text is a localized display string)
  // rather than assuming it, so this test still catches that regression
  // independent of wall-clock time.
  const bogotaToday = await page.evaluate(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  );
  await expect(page.getByLabel("Fecha de inicio")).toHaveAttribute(
    "data-value",
    bogotaToday
  );

  await page.getByRole("button", { name: "Enrolar" }).click();

  await expect(page.getByText("Pendiente de pago")).toBeVisible();

  // SubscriptionsSection renders each subscription inside a closed-by-default
  // Accordion item (base-ui's Accordion.Root defaults to an empty open-items
  // array); "Registrar pago" lives in the collapsed panel, so expand it by
  // clicking the trigger before the button becomes reachable. This is
  // unrelated to the client-search fix above -- pre-existing accordion
  // behavior that this test's original direct-click flow never accounted for.
  await page.getByText("Pendiente de pago").click();

  await page.getByRole("button", { name: "Registrar pago" }).click();
  // Método de pago is rendered as a plain icon-toggle button group (see
  // RecordPaymentDialog), not a Select -- click the option button directly
  // instead of opening a combobox and picking a role="option".
  await page.getByRole("button", { name: "Efectivo" }).click();
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
