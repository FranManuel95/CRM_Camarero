import { expect, test } from "@playwright/test";
import { entrar, listo, tokenDeMesa } from "./ayuda";

test("venta rápida en barra con propina", async ({ page }) => {
  await entrar(page);
  await page.getByRole("link", { name: "Venta rápida" }).click();
  await listo(page);
  await page.getByRole("tab", { name: "Cafés" }).click();
  await page.getByRole("button", { name: /^Café solo/ }).click();
  await page.getByRole("button", { name: /^Café solo/ }).click();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("radio", { name: "Tarjeta" }).click();
  await page.getByRole("button", { name: /Redondear/ }).click();
  await page.getByRole("button", { name: /Cobrar 3,00/ }).click();
  await expect(page.getByText("Cobrado", { exact: true })).toBeVisible();
  await expect(page.getByText("Nada todavía")).toBeVisible();
});

test("cobrar solo lo de uno y dejar la mesa abierta", async ({ page }, info) => {
  const mesa = info.project.name === "movil" ? "Mesa 7" : "Mesa 8";
  await entrar(page);
  await page.getByRole("tab", { name: "Salón" }).click();
  await page.getByRole("button", { name: new RegExp(`^${mesa} ?,`) }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("tab", { name: "Cervezas" }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  await page
    .getByRole("button", { name: /Mandar \(2\)/ })
    .first()
    .click();
  await expect(page.getByText("Comanda mandada")).toBeVisible();
  if (info.project.name === "movil") await page.getByRole("tab", { name: /Cuenta/ }).click();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("radio", { name: "Solo algunos platos" }).click();
  await page.getByRole("button", { name: "Una Caña más" }).click();
  await page.getByRole("radio", { name: "Tarjeta" }).click();
  await page.getByRole("button", { name: /Cobrar 2,00/ }).click();
  await expect(page.getByText("Ya pagado")).toBeVisible();
  await expect(page.getByText("Pagado", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/sala\/.+/);
});

test("para después y marcha", async ({ page, browser }, info) => {
  const mesa = info.project.name === "movil" ? "Terraza 5" : "Terraza 6";
  await entrar(page);
  await page.getByRole("tab", { name: "Terraza" }).click();
  await page.getByRole("button", { name: new RegExp(`^${mesa} ?,`) }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("tab", { name: "Raciones" }).click();
  await page
    .getByRole("button", { name: "Más opciones de Calamares a la andaluza: cantidad y nota" })
    .click();
  await page.getByText("Para después", { exact: true }).click();
  await page.getByRole("button", { name: /Anotar/ }).click();
  await page
    .getByRole("button", { name: /Mandar \(1\)/ })
    .first()
    .click();
  await expect(page.getByText("Comanda mandada")).toBeVisible();

  const contexto = await browser.newContext();
  const cocina = await contexto.newPage();
  await entrar(cocina, "2222");
  await cocina.goto("/cocina");
  await listo(cocina);
  const tarjeta = cocina.getByRole("listitem").filter({ hasText: mesa }).first();
  await expect(tarjeta).toContainText("Para después · espera la marcha");
  await expect(tarjeta).toContainText("Esperando la marcha");

  if (info.project.name === "movil") await page.getByRole("tab", { name: /Cuenta/ }).click();
  await page.getByRole("button", { name: /Marcha · 1 para después/ }).click();
  await expect(page.getByText("¡Marcha! Mandado a preparar")).toBeVisible();
  await expect(tarjeta.getByRole("button", { name: "Todo listo" })).toBeVisible();
  await contexto.close();
});

test("la carta QR se pone en inglés", async ({ page, browser }) => {
  await entrar(page);
  const token = await tokenDeMesa(page, "Mesa 3");
  const contexto = await browser.newContext();
  const cliente = await contexto.newPage();
  await cliente.goto(`/m/local/${token}`);
  await listo(cliente);
  await cliente.getByRole("button", { name: "English" }).click();
  await expect(cliente.getByRole("button", { name: "Call waiter" })).toBeVisible();
  await expect(cliente.getByText("Prices include VAT.")).toBeVisible();
  await cliente.reload();
  await listo(cliente);
  await expect(cliente.getByRole("button", { name: "Español" })).toBeVisible();
  await contexto.close();
});
