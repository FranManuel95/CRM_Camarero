import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar } from "./ayuda";

test("mandar sin papel, descuento a un artículo y «cobrar justo» al cobrar", async ({
  page,
}, info) => {
  const movil = info.project.name === "movil";
  const [zona, mesa] = movil ? ["Barra", "Barra 5"] : ["Terraza", "Terraza 4"];
  await entrar(page);
  await page.getByRole("tab", { name: new RegExp(zona) }).click();
  await page.getByRole("button", { name: new RegExp(`^${mesa} ?,`) }).click();
  await page.getByRole("button", { name: /^[1-4]$/ }).first().click();
  await expect(page.getByRole("heading", { name: mesa })).toBeVisible();

  await page.getByRole("tab", { name: "Cervezas" }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  if (movil) await page.getByRole("tab", { name: /Cuenta/ }).click();

  // Esta vez, solo a la pantalla de cocina.
  await page.getByRole("button", { name: /Comanda en papel: sí/ }).click();
  await expect(page.getByRole("button", { name: /Comanda en papel: no/ })).toBeVisible();
  await page.getByRole("button", { name: /Mandar \(2\)/ }).last().click();
  await expect(page.getByText("Mandada a pantalla (sin papel)")).toBeVisible();

  // Tocando el importe de la línea se abre con ella marcada.
  await page.getByRole("button", { name: /4,00 €\. Cambiar precio o descuento de Caña/ }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByRole("button", { name: /2 × Caña/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const axe = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await dialogo.getByRole("button", { name: "−10 %" }).click();
  await expect(dialogo.locator("p", { hasText: "Total ahora" })).toContainText("3,60");

  // «Cóbrale justo 3 €».
  await dialogo.getByRole("radio", { name: "Toda la cuenta" }).click();
  await dialogo.getByLabel("Cobrar justo").fill("3");
  await dialogo.getByRole("button", { name: "Dejarlo así" }).click();
  await expect(dialogo.locator("p", { hasText: "Total ahora" })).toContainText("3,00");
  await dialogo.getByRole("button", { name: "Hecho" }).click();

  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("radio", { name: /Tarjeta/ }).click();
  await page.getByRole("button", { name: /Cobrar 3,00 € y sacar ticket/ }).click();
  await expect(page).toHaveURL(/\/sala$/);
});

test("el encargado oculta un producto y lo puede seguir anotando", async ({ page }, info) => {
  test.skip(info.project.name === "movil", "Basta con una vez: cambia la carta de todos.");
  await entrar(page, "1234");
  await page.goto("/sala/rapida");
  await page.getByRole("tab", { name: "Cervezas" }).click();
  await page.getByRole("button", { name: "Más opciones de Tercio: cantidad y nota" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Oculto" }).click();
  await expect(page.getByText("Tercio: oculto")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
  // Sigue ahí para el encargado, marcado como oculto, y se puede anotar.
  const tercio = page.getByRole("button", { name: /^Tercio/ });
  await expect(tercio).toContainText("Oculto");
  await expect(tercio).toBeEnabled();

  // El camarero ya no lo ve.
  await page.getByRole("button", { name: /Salir/ }).click();
  await entrar(page, "1111");
  await page.goto("/sala/rapida");
  await page.getByRole("tab", { name: "Cervezas" }).click();
  await expect(page.getByRole("button", { name: /^Tercio/ })).toHaveCount(0);

  // Se deja como estaba.
  await page.getByRole("button", { name: /Salir/ }).click();
  await entrar(page, "1234");
  await page.goto("/sala/rapida");
  await page.getByRole("tab", { name: "Cervezas" }).click();
  await page.getByRole("button", { name: "Más opciones de Tercio: cantidad y nota" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Disponible" }).click();
  await expect(page.getByText("Tercio: disponible")).toBeVisible();
});
