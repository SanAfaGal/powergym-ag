import { test, expect } from "@playwright/test";

// Without a remembered camera permission the browser must ask first, which
// needs a user gesture: the kiosk shows the button instead of starting alone.
test.use({ permissions: [] });

test("without a granted permission the kiosk waits for the Activar cámara click", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("admin@powergym.local");
  await page.getByLabel("Contraseña").fill("devpassword123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/access");
  await expect(page.getByText("Cámara desactivada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Activar cámara" })).toBeVisible();
  await expect(page.getByText("Activá la cámara para empezar a verificar accesos")).toBeVisible();
});
