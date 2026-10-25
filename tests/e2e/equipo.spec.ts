import { expect, test } from "@playwright/test";
import { entrar, listo } from "./ayuda";

test("fichar un descanso con el PIN y volver", async ({ page }) => {
  await page.goto("/fichar");
  for (const cifra of "2222") await page.getByRole("button", { name: cifra, exact: true }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(page.getByRole("heading", { name: "Hola, Marta" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar un descanso" }).click();
  await expect(page.getByText(/Descanso empezado a las/)).toBeVisible();
  await page.getByRole("button", { name: "Listo" }).click();

  for (const cifra of "2222") await page.getByRole("button", { name: cifra, exact: true }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(page.getByText(/En el descanso desde las/)).toBeVisible();
  await page.getByRole("button", { name: "Volver del descanso" }).click();
  await expect(page.getByText(/Vuelta del descanso apuntada/)).toBeVisible();
});

test("el encargado pone un turno y corrige un fichaje", async ({ page }) => {
  await entrar(page, "1234");
  await page.goto("/gestion/equipo/cuadrante");
  await listo(page);
  await page
    .getByRole("button", { name: /^Añadir un turno a Luis/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Guardar turno" }).click();
  await expect(page.getByText("Turno guardado")).toBeVisible();

  await page.getByRole("link", { name: /Fichajes/ }).click();
  await listo(page);
  await page
    .getByRole("button", { name: /^Corregir el fichaje de Luis/ })
    .first()
    .click();
  await page.getByLabel("Motivo").fill("Prueba de corrección");
  await page.getByRole("button", { name: "Guardar la corrección" }).click();
  await expect(page.getByText("Fichaje corregido")).toBeVisible();
  await expect(page.getByText("corregido: Prueba de corrección").first()).toBeVisible();
});
