import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar } from "./ayuda";

test.describe("herramientas del encargado", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === "movil", "Basta con una vez: tocan datos de todos.");
  });

  test("el buscador de Gestión lleva a una sección y abre un producto", async ({ page }) => {
    await entrar(page, "1234");
    await page.goto("/gestion");
    const buscador = page.getByRole("searchbox", { name: "Buscar en Gestión" });
    await buscador.fill("nif");
    await page
      .getByRole("region", { name: "Secciones" })
      .getByRole("link", { name: /^Ajustes/ })
      .click();
    await expect(page).toHaveURL(/\/gestion\/ajustes$/);
    await expect(page.getByRole("heading", { name: "Ajustes", level: 1 })).toBeVisible();

    await buscador.fill("cana");
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.getByRole("region", { name: "Carta" }).getByRole("link", { name: /^Caña/ }).click();
    await expect(page.getByRole("dialog", { name: "Editar producto" })).toBeVisible();
  });

  test("subir precios enseña cómo quedan antes de aplicar", async ({ page }) => {
    await entrar(page, "1234");
    await page.goto("/gestion/carta");
    await page.getByRole("button", { name: "Cambiar precios" }).click();
    const dialogo = page.getByRole("dialog", { name: "Cambiar precios de golpe" });
    await dialogo.getByRole("button", { name: "Cervezas" }).click();
    await dialogo.getByLabel("Cuánto (%)").fill("10");
    const fila = dialogo.getByRole("row").filter({ hasText: /^Caña/ });
    await expect(fila).toContainText("2,00");
    await expect(fila).toContainText("2,20");
    const axe = await new AxeBuilder({ page }).include("dialog").analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    // Sin aplicar: el resto de pruebas cuentan con los precios de siempre.
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
  });

  test("el cierre de caja va paso a paso y la caja se vuelve a abrir", async ({ page }) => {
    await entrar(page, "1234");
    await page.goto("/caja");
    await page.getByRole("button", { name: "Cerrar caja (Z)" }).click();
    const dialogo = page.getByRole("dialog", { name: "Cerrar caja" });
    await expect(dialogo.getByRole("listitem").filter({ hasText: "1. Pendiente" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await dialogo.getByRole("button", { name: "Seguir: contar el cajón" }).click();
    await dialogo.getByLabel("O, si ya lo tienes contado, el total").fill("150");
    await dialogo.getByRole("button", { name: "Seguir: ver el resumen" }).click();
    await expect(dialogo).toContainText("Cajón: contado 150,00 €");
    const axe = await new AxeBuilder({ page }).include("dialog").analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await dialogo.getByRole("button", { name: "Cerrar caja y sacar el Z" }).click();
    await expect(page.getByText("La caja está cerrada")).toBeVisible();
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(page.getByRole("button", { name: "Cerrar caja (Z)" })).toBeVisible();
  });
});
