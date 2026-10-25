import { expect, test } from "@playwright/test";
import { entrar, listo } from "./ayuda";

test("apagar y encender una función desde Gestión → Funciones", async ({ page }) => {
  await entrar(page, "1234");
  await page.goto("/gestion/funciones");
  await listo(page);
  const interruptor = page.getByRole("checkbox", { name: "Venta rápida" });
  await expect(interruptor).toBeChecked();
  await page.getByText("Venta rápida", { exact: true }).click();
  await expect(page.getByText("Venta rápida: apagado")).toBeVisible();

  await page.goto("/sala");
  await listo(page);
  await expect(page.getByRole("link", { name: "Venta rápida" })).toHaveCount(0);
  await page.goto("/sala/rapida");
  await listo(page);
  await expect(page.getByText("Venta rápida está apagado")).toBeVisible();

  // Se deja como estaba para el resto de pruebas.
  await page.goto("/gestion/funciones");
  await listo(page);
  await page.getByText("Venta rápida", { exact: true }).click();
  await expect(page.getByText("Venta rápida: encendido")).toBeVisible();
  await expect(interruptor).toBeChecked();
});
