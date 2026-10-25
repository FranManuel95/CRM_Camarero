import { expect, test } from "@playwright/test";
import { entrar, listo } from "./ayuda";

// El móvil más estrecho que se usa de verdad: nada debe salirse por los lados.
test.use({ viewport: { width: 360, height: 740 } });

const RUTAS = [
  "/sala",
  "/sala/rapida",
  "/cocina",
  "/caja",
  "/gestion",
  "/gestion/informes",
  "/gestion/gastos",
  "/gestion/carta",
  "/gestion/stock",
  "/gestion/mesas",
  "/gestion/mesas/qr",
  "/gestion/equipo",
  "/gestion/equipo/cuadrante",
  "/gestion/equipo/fichajes",
  "/gestion/impresoras",
  "/gestion/ajustes",
  "/gestion/funciones",
  "/gestion/historial",
];

test("a 360 px ninguna pantalla se sale por los lados", async ({ page }) => {
  await entrar(page, "1234");
  const anchos: string[] = [];
  for (const ruta of RUTAS) {
    await page.goto(ruta);
    await listo(page);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > 360) anchos.push(`${ruta}: ${ancho}px`);
  }
  expect(anchos).toEqual([]);
});

test("en el móvil se llega a todas las secciones sin deslizar", async ({ page }) => {
  await entrar(page, "1234");
  for (const nombre of ["Sala", "Cocina", "Barra", "Caja", "Gestión", "Fichar", "Salir"]) {
    // «Sala» lleva el número de avisos pendientes en el nombre («Sala 2 avisos»).
    const enlace = page
      .getByRole("navigation", { name: "Principal" })
      .getByRole(nombre === "Salir" ? "button" : "link", { name: new RegExp(`^${nombre}\\b`) });
    await expect(enlace).toBeInViewport();
  }
  await page.goto("/gestion");
  await listo(page);
  await page.getByRole("button", { name: /Otras secciones/ }).click();
  await page.getByRole("link", { name: "Stock" }).click();
  await expect(page).toHaveURL(/\/gestion\/stock/);
});
