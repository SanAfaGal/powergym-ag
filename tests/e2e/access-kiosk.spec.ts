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

test("the Acceso link is in the sidebar for employees", async ({ page }) => {
  await login(page, EMPLOYEE);
  await expect(page.getByRole("link", { name: "Acceso" })).toBeVisible();
});

test("with the permission already granted the kiosk starts the camera by itself", async ({
  page,
}) => {
  // First model load (~265 MB over WASM) can take a while on a cold cache.
  test.setTimeout(150_000);
  await login(page, ADMIN);
  await page.goto("/access");
  // no click on "Activar cámara": the config grants the camera permission
  await expect(page.getByText("Cámara activa")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Barrera bloqueada")).toBeVisible();
});

test("with the fake camera the kiosk reports no face and keeps the barrier locked", async ({
  page,
}) => {
  // First model load (~265 MB over WASM) can take a while on a cold cache.
  test.setTimeout(150_000);
  await login(page, ADMIN);
  await page.goto("/access");
  await expect(page.getByText("No se detecta un rostro")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("Barrera bloqueada")).toBeVisible();
});

test("a denied camera permission shows a clear error and never opens the barrier", async ({
  page,
}) => {
  // The suite-wide fake-ui flag auto-grants the prompt, and launch options
  // cannot be overridden per describe block, so the denial is simulated at
  // the API the app calls.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await login(page, ADMIN);
  await page.goto("/access");
  // the permission is granted in the config, so the kiosk starts by itself and
  // hits the stubbed denial without any click
  await expect(page.getByText(/Permiso de cámara denegado/)).toBeVisible();
  await expect(page.getByText("Barrera bloqueada")).toBeVisible();
});
