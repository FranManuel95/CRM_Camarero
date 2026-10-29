import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar } from "./ayuda";

test("el encargado dibuja el local y deja una mesa sin ticket en papel", async ({ page }, info) => {
  test.skip(info.project.name === "movil", "Basta con una vez: cambia el plano de todos.");
  await entrar(page, "1234");
  await page.goto("/gestion/mesas");
  await page.getByRole("button", { name: "Salón" }).click();
  // El bar de ejemplo ya tiene su entrada y sus ventanas dibujadas.
  await expect(page.getByRole("button", { name: /^Puerta: Entrada/ })).toBeVisible();

  const añadir = page.getByRole("group", { name: "Añadir al plano" });
  await añadir.getByRole("button", { name: "Columna" }).click();
  await expect(page.getByText("Columna añadido al plano")).toBeVisible();
  const columna = page.getByRole("button", { name: /^Columna\./ });
  await columna.click();
  await page.getByRole("button", { name: "Girar" }).click();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Quitar" }).click();
  await expect(columna).toHaveCount(0);

  // Una mesa nueva, en una zona propia, que nunca saca el ticket en papel.
  page.once("dialog", (d) => d.accept("Prueba papel"));
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Prueba papel" }).click();
  await page.getByRole("button", { name: "Añadir mesa" }).click();
  const aviso = await page.getByText(/Mesa \d+ añadida/).textContent();
  const mesa = aviso!.match(/Mesa \d+/)![0];
  await page.getByRole("button", { name: new RegExp(`^${mesa}\\.`) }).click();
  await page.getByRole("checkbox", { name: /Sin ticket en papel/ }).check();

  await page.goto("/sala");
  await page.getByRole("tab", { name: /Prueba papel/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${mesa} ?,`) }).click();
  await page
    .getByRole("button", { name: /^[1-4]$/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "Cervezas" }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  await page
    .getByRole("button", { name: /Mandar \(1\)/ })
    .last()
    .click();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("radio", { name: /Tarjeta/ }).click();
  await expect(page.getByRole("button", { name: /Ticket en papel: no/ })).toBeVisible();
  await page.getByRole("button", { name: /Cobrar 2,00 € sin ticket/ }).click();
  await expect(page).toHaveURL(/\/sala$/);

  // Se deja como estaba.
  await page.goto("/gestion/mesas");
  await page.getByRole("button", { name: "Prueba papel" }).click();
  await page.getByRole("button", { name: new RegExp(`^${mesa}\\.`) }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Borrar", exact: true }).click();
  await expect(page.getByText("Mesa borrada")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Borrar zona" }).click();
  await expect(page.getByText("Zona borrada")).toBeVisible();
});
