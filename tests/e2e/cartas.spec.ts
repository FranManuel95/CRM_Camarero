import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar, listo, tokenDeMesa } from "./ayuda";

// Pase lo que pase, las cartas de esta prueba se quitan: si se quedaran, el camarero vería solo
// esa carta y las demás pruebas no encontrarían sus categorías.
test.afterEach(async ({ page }, info) => {
  const r = await page.request.get("/api/estado");
  if (!r.ok()) return;
  const estado = (await r.json()) as { cartas?: { id: string; nombre: string }[] };
  for (const c of estado.cartas ?? [])
    if (c.nombre.endsWith(info.project.name))
      await page.request.post("/api/acciones", {
        data: { accion: { tipo: "borrar_carta_horaria", cartaId: c.id } },
      });
});

test("cartas: el encargado crea una con nombre, el camarero y el cliente la eligen", async ({
  page,
  browser,
}, info) => {
  const nombre = `Carta ${info.project.name}`;
  await entrar(page, "1234");
  await page.goto("/gestion/carta");
  await listo(page);
  const seccion = page.getByRole("region", { name: "Cartas", exact: true });
  await seccion.getByRole("button", { name: "Añadir" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo
    .getByLabel(/^Nombre/)
    .first()
    .fill(nombre);
  await dialogo.getByRole("button", { name: "Tapas", exact: true }).click();
  // «region» es de la página entera, no de un diálogo.
  const axe = await new AxeBuilder({ page }).include("dialog").disableRules(["region"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(seccion.getByText(nombre)).toBeVisible();

  // Sin horario: el camarero la tiene a un toque, y puede abrir toda.
  await page.goto("/sala/rapida");
  await listo(page);
  const elegir = page.getByRole("group", { name: "Carta" });
  await expect(elegir.getByRole("button", { name: nombre, exact: true })).toBeVisible();
  await elegir.getByRole("button", { name: "Toda la carta" }).click();
  await expect(page.getByRole("tab", { name: "Tapas" })).toBeVisible();

  // El cliente ve el nombre de la carta en el QR.
  const token = await tokenDeMesa(page, "Mesa 2");
  const cliente = await (await browser.newContext()).newPage();
  await cliente.goto(`/m/local/${token}`);
  await expect(cliente.getByText(nombre)).toBeVisible();

  // Con una segunda carta, el cliente elige entre las dos con pestañas.
  const copas = `Copas ${info.project.name}`;
  await page.goto("/gestion/carta");
  await listo(page);
  await seccion.getByRole("button", { name: "Añadir" }).click();
  await dialogo
    .getByLabel(/^Nombre/)
    .first()
    .fill(copas);
  await dialogo.getByRole("button", { name: "Cervezas", exact: true }).click();
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(seccion.getByText(copas)).toBeVisible();
  await cliente.reload();
  const pestanas = cliente.getByRole("group", { name: "Cartas" });
  await pestanas.getByRole("button", { name: copas }).click();
  await expect(cliente.getByRole("heading", { name: "Cervezas" })).toBeVisible();
  await expect(cliente.getByRole("heading", { name: "Tapas" })).toHaveCount(0);
  await pestanas.getByRole("button", { name: nombre }).click();
  await expect(cliente.getByRole("heading", { name: "Tapas" })).toBeVisible();
  const axeCliente = await new AxeBuilder({ page: cliente }).analyze();
  expect(axeCliente.violations.map((v) => v.id)).toEqual([]);
  await cliente.context().close();

  // Las quitamos para no cambiar las demás pruebas.
  for (const n of [nombre, copas]) {
    page.once("dialog", (d) => void d.accept());
    await seccion.getByRole("button", { name: `Quitar ${n}` }).click();
    await expect(seccion.getByText(n)).toHaveCount(0);
  }
});
