import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar, listo, tokenDeMesa } from "./ayuda";

test("cartas por horario: el encargado la crea, el camarero la ve primero y el cliente solo esa", async ({
  page,
  browser,
}, info) => {
  const nombre = `Carta ${info.project.name}`;
  await entrar(page, "1234");
  await page.goto("/gestion/carta");
  await listo(page);
  const seccion = page.getByRole("region", { name: "Cartas por horario" });
  await seccion.getByRole("button", { name: "Añadir" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel(/^Nombre/).first().fill(nombre);
  // Todo el día, para que toque ahora sea la hora que sea.
  await dialogo.getByLabel("Desde").fill("00:00");
  await dialogo.getByLabel("Hasta").fill("23:59");
  await dialogo.getByRole("button", { name: "Tapas", exact: true }).click();
  const axe = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(seccion.getByText(nombre)).toBeVisible();

  // El camarero ve primero la carta que toca, y puede abrir toda.
  await page.goto("/sala/rapida");
  await listo(page);
  const elegir = page.getByRole("group", { name: "Carta" });
  await expect(
    elegir.getByRole("button", { name: new RegExp(`^Ahora · .*${nombre}`) }),
  ).toBeVisible();
  await elegir.getByRole("button", { name: "Toda la carta" }).click();
  await expect(page.getByRole("tab", { name: "Tapas" })).toBeVisible();

  // El cliente ve el nombre de la carta en el QR.
  const token = await tokenDeMesa(page, "Mesa 2");
  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(`/m/local/${token}`);
  await expect(cliente.getByText(nombre)).toBeVisible();
  await cliente.context().close();

  // La quitamos para no cambiar las demás pruebas.
  await page.goto("/gestion/carta");
  await listo(page);
  page.once("dialog", (d) => void d.accept());
  await seccion.getByRole("button", { name: `Quitar ${nombre}` }).click();
  await expect(seccion.getByText(nombre)).toHaveCount(0);
});
