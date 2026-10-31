import { test, expect, type Page } from "@playwright/test";

// Credentials from supabase/seed.sql -- keep in sync if that file changes.
const ADMIN = { email: "admin@powergym.local", password: "devpassword123" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(ADMIN.email);
  await page.getByLabel("Contraseña").fill(ADMIN.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/dashboard");
}

async function openMaria(page: Page) {
  await page.goto("/clients");
  const search = page
    .getByPlaceholder("Buscar por nombre, alias, documento o email...")
    .first();
  await search.waitFor();
  await search.fill("Maria Gomez");
  await page.waitForURL(/[?&]q=Maria(\+|%20)Gomez/);
  await page.getByRole("link", { name: "Maria Gomez" }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/);
  await expect(page.getByText("Acceso facial")).toBeVisible();
}

// The consent and template persist in the local DB between runs, so every
// test starts (and ends) from a clean slate: an admin deleting the facial
// record also revokes the consent.
async function resetFaceRecord(page: Page) {
  const cancelCapture = page.getByRole("dialog").getByRole("button", { name: "Cancelar" });
  if (await cancelCapture.isVisible()) await cancelCapture.click();
  const del = page.getByRole("button", { name: "Eliminar registro facial" });
  if (await del.isVisible()) {
    await del.click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Sin consentimiento")).toBeVisible();
  }
}

// Both tests share one seeded client and its single facial record.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await login(page);
  await openMaria(page);
  await resetFaceRecord(page);
});

test.afterEach(async ({ page }) => {
  await resetFaceRecord(page);
});

test("without consent the face cannot be registered", async ({ page }) => {
  await expect(page.getByText("Sin consentimiento")).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar rostro" })).toBeDisabled();
});

test("recording consent enables the camera step, which reports no face on the fake camera", async ({
  page,
}) => {
  // First model load (~265 MB over WASM) can take a while on a cold cache.
  test.setTimeout(150_000);
  await page.getByRole("button", { name: "Registrar consentimiento" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Guardar consentimiento" });
  await expect(save).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await save.click();

  await expect(page.getByText("Consentimiento registrado")).toBeVisible();
  await page.getByRole("button", { name: "Registrar rostro" }).click();
  await expect(page.getByText("Cámara desactivada")).toBeVisible();

  await page.getByRole("button", { name: "Activar cámara" }).click();
  // Models are ~265 MB and load over WASM: allow for a slow first load.
  await expect(page.getByText("No se detecta un rostro")).toBeVisible({
    timeout: 90_000,
  });
});
