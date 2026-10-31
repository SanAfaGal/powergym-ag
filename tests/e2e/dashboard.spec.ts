import { test, expect } from "@playwright/test";

// Credentials from supabase/seed.sql -- keep in sync if that file changes.
const ADMIN = { email: "admin@powergym.local", password: "devpassword123" };

async function login(page: import("@playwright/test").Page, creds: typeof ADMIN) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(creds.email);
  await page.getByLabel("Contraseña").fill(creds.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/dashboard");
}

test("admin sees dashboard KPIs, breakdowns, and can filter by date range", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto("/dashboard");

  // KPI row (DashboardKpiRow) renders all four tiles.
  await expect(page.getByText("Clientes activos")).toBeVisible();
  await expect(page.getByText("Clientes nuevos")).toBeVisible();
  await expect(page.getByText("Ingresos en rango")).toBeVisible();
  await expect(page.getByText("Deuda pendiente")).toBeVisible();

  // Default range is the current Bogota month-to-date (DashboardPage falls
  // back to `${today.slice(0, 7)}-01`..today when no ?start=/?end= is set),
  // reflected in the two DashboardFilters date pickers. DatePicker (a
  // Popover+Calendar button, not a native input) exposes the raw
  // "yyyy-MM-dd" value via data-value -- its visible text is a localized
  // display string ("17 jul 2026"), not the value.
  const bogotaToday = await page.evaluate(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  );
  const monthStart = `${bogotaToday.slice(0, 7)}-01`;
  await expect(page.getByLabel("Desde")).toHaveAttribute("data-value", monthStart);
  await expect(page.getByLabel("Hasta")).toHaveAttribute("data-value", bogotaToday);

  // Status and revenue-by-method breakdown sections render.
  await expect(page.getByText("Suscripciones por estado")).toBeVisible();
  await expect(page.getByText("Ingresos por método de pago")).toBeVisible();

  // Exercise the date-range filter.
  const hastaButton = page.getByLabel("Hasta");
  // DashboardFilters is a client component; the SSR'd HTML already shows
  // the right value/content before hydration attaches the click handler,
  // so an assertion against that content can pass before hydration
  // finishes. Wait for the control to be interactive and let hydration
  // settle before driving it.
  await hastaButton.waitFor();
  await page.waitForTimeout(300);

  const revenueValue = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Ingresos en rango" })
    .locator("p.font-heading");
  // Seed payments are dated "now" and the default range covers the current
  // month, so some revenue should show before we narrow the range below.
  await expect(revenueValue).not.toHaveText("$0");

  // Moving "Hasta" to the 15th of the previous month pushes both params to
  // the URL and, since the RPC's `between p_start and p_end` can never
  // match when p_end < p_start, deterministically zeroes revenue_in_range
  // regardless of exactly what payments exist -- a stronger, non-brittle
  // way to prove the filter round-trips to the server than asserting an
  // exact total.
  await hastaButton
    .locator("..")
    .getByRole("button", { name: "Abrir calendario" })
    .click();
  await page.getByRole("button", { name: "Go to the Previous Month" }).click();
  await page
    .locator('[data-slot="calendar"]')
    .getByRole("button", { name: /, 15 de /})
    .click();

  const [year, month] = monthStart.split("-").map(Number);
  const prevMonth15 = new Date(Date.UTC(year, month - 2, 15))
    .toISOString()
    .slice(0, 10);

  await expect(page).toHaveURL(
    new RegExp(`start=${monthStart}.*end=${prevMonth15}`)
  );
  await expect(revenueValue).toHaveText("$0");
});

test("a date can be typed, and an old date is picked with the year dropdown", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto("/dashboard");

  const desde = page.getByLabel("Desde");
  await desde.waitFor();
  // wait for hydration before typing (see the note in the test above)
  await page.waitForTimeout(300);

  // typing digits is enough: the slashes go in by themselves
  await desde.fill("");
  await desde.pressSequentially("05032026");
  await expect(desde).toHaveValue("05/03/2026");
  await expect(desde).toHaveAttribute("data-value", "2026-03-05");
  await expect(page).toHaveURL(/start=2026-03-05/);

  // an impossible date is not kept: leaving the box restores the last good one
  await desde.fill("");
  await desde.pressSequentially("31042026");
  await desde.blur();
  await expect(desde).toHaveValue("05/03/2026");

  // an old date through the calendar: year and month dropdowns, no month-by-month
  await desde
    .locator("..")
    .getByRole("button", { name: "Abrir calendario" })
    .click();
  const calendar = page.locator('[data-slot="calendar"]');
  await calendar.getByLabel("Choose the Year").selectOption("2024");
  await calendar.getByRole("button", { name: /, 10 de / }).click();
  await expect(desde).toHaveAttribute("data-value", /^2024-\d{2}-10$/);
});
