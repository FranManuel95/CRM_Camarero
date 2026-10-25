import { expect, test } from "@playwright/test";
import { entrar, listo } from "./ayuda";

test("contar, ver la lista de la compra y recibir el pedido", async ({ page }) => {
  await entrar(page, "1234");
  await page.goto("/gestion/stock");
  await listo(page);

  await page.getByRole("button", { name: "Contar Pulpo cocido" }).click();
  await page.getByLabel("¿Cuánto hay ahora? (kg)").fill("0,5");
  await page.getByRole("button", { name: "Guardar recuento" }).click();
  await expect(page.getByText("Recuento apuntado")).toBeVisible();

  await page.getByRole("tab", { name: /Lista de la compra/ }).click();
  const pedido = page.getByRole("region", { name: "Pedido a Lonja Inventada" });
  await expect(pedido.getByText("Pulpo cocido")).toBeVisible();
  await pedido.getByRole("button", { name: "Ha llegado" }).click();
  await page.getByRole("button", { name: "Sumar al stock" }).click();
  await expect(page.getByText("Pedido recibido: el stock está al día")).toBeVisible();
  await expect(pedido).toBeHidden();

  await page.getByRole("tab", { name: "Movimientos" }).click();
  await expect(page.getByText("Compra · Lonja Inventada").first()).toBeVisible();

  await page.goto("/gestion/gastos");
  await listo(page);
  await expect(page.getByText(/^Pedido: .*Pulpo cocido/).first()).toBeVisible();
});
