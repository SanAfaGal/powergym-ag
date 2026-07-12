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

test("admin sees dashboard KPIs, breakdowns, a debtor/expiring row, and can filter by date range", async ({
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
  // reflected in the two DashboardFilters date inputs.
  const bogotaToday = await page.evaluate(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  );
  const monthStart = `${bogotaToday.slice(0, 7)}-01`;
  await expect(page.getByLabel("Desde")).toHaveValue(monthStart);
  await expect(page.getByLabel("Hasta")).toHaveValue(bogotaToday);

  // Status and revenue-by-method breakdown sections render.
  await expect(page.getByText("Suscripciones por estado")).toBeVisible();
  await expect(page.getByText("Ingresos por método de pago")).toBeVisible();

  // Both DebtorsList/ExpiringSoonList render a desktop <table> ("hidden
  // md:block") and a mobile card list ("flex ... md:hidden") at the same
  // time -- only one is display:none depending on viewport, so scope
  // locators to each section's own Card (data-slot="card") to avoid
  // matching the same client name twice, and use getByRole("link", ...)
  // which Playwright only resolves against the accessibility tree (so the
  // display:none list at this desktop viewport is naturally excluded).
  //
  // seed.sql seeds Carlos Ramirez with an active subscription that's both
  // partially paid (a debtor) and expiring within 7 days, so these
  // assertions exercise real rows rather than only the empty states.
  const debtorsCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Clientes con saldo pendiente" });
  const debtorLink = debtorsCard.getByRole("link", { name: "Carlos Ramirez" });
  await expect(debtorLink).toBeVisible();

  const expiringCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Suscripciones por vencer" });
  await expect(
    expiringCard.getByRole("link", { name: "Carlos Ramirez" })
  ).toBeVisible();

  // Clicking the debtor row's link navigates to that client's detail page.
  await debtorLink.click();
  await expect(page).toHaveURL(
    "http://localhost:3000/clients/20000000-0000-0000-0000-000000000003"
  );

  // Back to the dashboard to exercise the date-range filter.
  await page.goto("/dashboard");
  const hastaInput = page.getByLabel("Hasta");
  // DashboardFilters is a client component; the SSR'd HTML already shows
  // the right value/content before hydration attaches the onChange
  // listener, so an assertion against that content can pass before
  // hydration finishes. Wait for the input to be interactive and let
  // hydration settle before driving it, or fill() below can race React
  // attaching its listeners and silently no-op (observed while writing
  // this test: fill() would set the DOM value but never call pushRange).
  await hastaInput.waitFor();
  await page.waitForTimeout(300);

  const revenueValue = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Ingresos en rango" })
    .locator("p.font-heading");
  // Seed payments are dated "now" and the default range covers the current
  // month, so some revenue should show before we narrow the range below.
  await expect(revenueValue).not.toHaveText("$0");

  // Moving "Hasta" before "Desde" pushes both params to the URL and, since
  // the RPC's `between p_start and p_end` can never match when
  // p_end < p_start, deterministically zeroes revenue_in_range regardless
  // of exactly what payments exist -- a stronger, non-brittle way to prove
  // the filter round-trips to the server than asserting an exact total.
  await hastaInput.fill("2000-01-01");
  await expect(page).toHaveURL(new RegExp(`start=${monthStart}.*end=2000-01-01`));
  await expect(revenueValue).toHaveText("$0");
});
