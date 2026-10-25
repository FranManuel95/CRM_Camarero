import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar, listo, tokenDeMesa } from "./ayuda";

test("sin PIN no se entra a la sala", async ({ page }) => {
  await page.goto("/sala");
  await expect(page).toHaveURL(/\/entrar/);
  for (const cifra of "9999") await page.getByRole("button", { name: cifra, exact: true }).click();
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("#error-pin")).toContainText("no es de nadie");
});

test("el camarero anota, manda a cocina, cocina lo marca listo y se cobra", async ({
  page,
  browser,
}, info) => {
  const mesa = info.project.name === "movil" ? "Mesa 5" : "Mesa 6";
  await entrar(page);
  await page.getByRole("tab", { name: "Salón" }).click();
  await page.getByRole("button", { name: new RegExp(`^${mesa} ?,`) }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByRole("heading", { name: mesa })).toBeVisible();

  // Anota dos cañas y unas bravas con nota.
  await page.getByRole("tab", { name: "Cervezas" }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  await page.getByRole("tab", { name: "Tapas" }).click();
  await page.getByRole("button", { name: "Más opciones de Patatas bravas" }).click();
  await page.getByLabel("Nota para cocina o barra").fill("Sin alioli");
  await page.getByRole("button", { name: /Anotar/ }).click();
  await page.getByRole("button", { name: /Mandar \(3\)/ }).click();
  await expect(page.getByText("Comanda mandada")).toBeVisible();

  // La cocina lo ve y lo marca listo.
  const contextoCocina = await browser.newContext();
  const cocina = await contextoCocina.newPage();
  await entrar(cocina, "2222");
  await cocina.goto("/cocina");
  await listo(cocina);
  const tarjeta = cocina.getByRole("listitem").filter({ hasText: mesa }).first();
  await expect(tarjeta).toContainText("¡Sin alioli!");
  await tarjeta.getByRole("button", { name: "Todo listo" }).click();
  await expect(tarjeta.getByRole("button", { name: "Recogido" })).toBeVisible();
  await contextoCocina.close();

  // Se cobra en efectivo con 20 €: 2 cañas (4 €) + bravas (5,50 €) = 9,50 €.
  if (info.project.name === "movil") await page.getByRole("tab", { name: /Cuenta/ }).click();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("button", { name: "20 €" }).click();
  await expect(page.getByText("Cambio:")).toContainText("10,50");
  await page.getByRole("button", { name: /Cobrar 9,50/ }).click();
  await expect(page).toHaveURL(/\/sala$/);
  await expect(page.getByText(/Cobrado\. Cambio/)).toBeVisible();
});

test("un cliente pide desde el QR y el camarero lo acepta", async ({ page, browser }, info) => {
  const mesa = info.project.name === "movil" ? "Terraza 1" : "Terraza 2";
  await entrar(page);
  const token = await tokenDeMesa(page, mesa);

  const contextoCliente = await browser.newContext();
  const cliente = await contextoCliente.newPage();
  await cliente.goto(`/m/${token}`);
  await listo(cliente);
  await expect(cliente.getByRole("heading", { name: "La Esquina", exact: true })).toBeVisible();
  await cliente.getByRole("button", { name: "Añadir Croquetas de jamón (4 uds.)" }).click();
  await cliente.getByRole("button", { name: "Añadir Hamburguesa La Esquina" }).click();
  await cliente.getByRole("button", { name: "Al punto" }).click();
  await cliente.getByRole("button", { name: "Bacon +1,50 €" }).click();
  await cliente.getByRole("button", { name: /Añadir · 13,00/ }).click();
  await cliente.getByRole("button", { name: /Ver pedido \(2\)/ }).click();
  await cliente.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(cliente.getByText("¡Pedido enviado!")).toBeVisible();

  // Al camarero le sale el aviso y lo acepta desde la mesa.
  await page.goto("/sala");
  await listo(page);
  const aviso = page.getByRole("listitem").filter({ hasText: `${mesa} · Pedido desde el QR` });
  await expect(aviso).toBeVisible();
  await aviso.getByRole("link", { name: "Ver" }).click();
  await page.getByRole("button", { name: "Aceptar y mandar" }).click();
  await expect(page.getByText("Mandado a cocina y barra")).toBeVisible();

  // El cliente ve que se está preparando y pide la cuenta.
  await cliente.getByRole("button", { name: /Mi cuenta/ }).click();
  await expect(cliente.getByRole("dialog")).toContainText("Preparando");
  await expect(cliente.getByRole("dialog")).toContainText("19,50");
  await cliente.getByRole("button", { name: "Con tarjeta" }).click();
  await expect(cliente.getByText("Ya hemos avisado: te traen la cuenta.")).toBeVisible();

  const accesibilidad = await new AxeBuilder({ page: cliente }).analyze();
  expect(accesibilidad.violations.map((v) => v.id)).toEqual([]);
  await contextoCliente.close();
});

test("las pantallas principales pasan la revisión de accesibilidad", async ({ page }) => {
  await entrar(page, "1234");
  for (const ruta of [
    "/sala",
    "/cocina",
    "/caja",
    "/gestion",
    "/gestion/informes",
    "/gestion/carta",
    "/gestion/stock",
    "/gestion/equipo",
    "/gestion/equipo/cuadrante",
    "/gestion/equipo/fichajes",
    "/gestion/funciones",
    "/gestion/historial",
    "/sala/reservas",
    "/fichar",
    "/gestion/impresoras",
  ]) {
    await page.goto(ruta);
    // /fichar no recibe datos en directo: no hay que esperar a la conexión.
    if (ruta === "/fichar") await page.getByRole("button", { name: "Seguir" }).waitFor();
    else await listo(page);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${ruta}: ${v.id}`)).toEqual([]);
  }
});
