import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { entrar, listo } from "./ayuda";

type Estado = {
  mesas: { id: string; nombre: string; virtual?: boolean }[];
  cuentas: {
    id: string;
    mesaId: string;
    estado: string;
    lineas: { id: string; nombre: string }[];
  }[];
  productos: {
    id: string;
    nombre: string;
    disponible: boolean;
    oculto?: boolean;
    grupos: unknown[];
  }[];
};
const leer = async (page: Page) => (await (await page.request.get("/api/estado")).json()) as Estado;
const accion = (page: Page, a: object) =>
  page.request.post("/api/acciones", { data: { accion: a } });

test("la ayuda explica cómo cambiar un precio y deja la cuenta abierta en el sitio", async ({
  page,
}, info) => {
  await entrar(page, "1234");
  // Una mesa con algo anotado, para que la ayuda pregunte «¿de qué mesa?».
  let e = await leer(page);
  const ocupadas = new Set(e.cuentas.filter((c) => c.estado === "abierta").map((c) => c.mesaId));
  const mesa = e.mesas
    .filter((m) => !m.virtual && !ocupadas.has(m.id))
    .at(info.project.name === "movil" ? -1 : -2)!;
  const plato = e.productos.find((p) => p.disponible && !p.oculto && !p.grupos.length)!;
  const cuentaId = `sr-ayuda-${info.project.name}-${Date.now().toString(36)}`;
  await accion(page, { tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2, cuentaId });
  await accion(page, {
    tipo: "anotar",
    cuentaId,
    lineas: [{ productoId: plato.id, cantidad: 1, opciones: [], nota: "" }],
  });
  e = await leer(page);
  const linea = e.cuentas.find((c) => c.id === cuentaId)!.lineas[0]!;

  try {
    await page.goto("/sala");
    await listo(page);
    await page.getByRole("button", { name: "Ayuda" }).click();
    const dialogo = page.getByRole("dialog", { name: "Ayuda" });
    await dialogo
      .getByRole("searchbox", { name: "¿Qué quieres hacer?" })
      .fill("cómo le subo el precio a un producto cuando voy a cobrar");
    await expect(
      dialogo
        .locator("summary")
        .filter({ hasText: "Cambiar el precio de un producto en una cuenta" }),
    ).toBeVisible();
    await expect(dialogo.getByText(/Precio nuevo por unidad/).first()).toBeVisible();
    const axe = await new AxeBuilder({ page }).include("dialog").disableRules(["region"]).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    await dialogo.getByRole("button", { name: "Llévame ahí" }).first().click();
    await dialogo
      .getByRole("group", { name: "¿De qué mesa?" })
      .getByRole("button", { name: new RegExp(`^${mesa.nombre} ·`) })
      .click();
    await dialogo
      .getByRole("group", { name: "¿Qué producto de la cuenta?" })
      .getByRole("button", { name: `1× ${linea.nombre}` })
      .click();

    await expect(page).toHaveURL(new RegExp(`/sala/${mesa.id}\\?abrir=precios&lineas=${linea.id}`));
    const precios = page.getByRole("dialog", { name: "Precios y descuentos" });
    await expect(precios).toBeVisible();
    await expect(precios.getByLabel("Precio nuevo por unidad")).toBeVisible();
  } finally {
    await accion(page, { tipo: "anular_cuenta", cuentaId });
  }
});

test("al camarero le dice que eso lo hace el encargado, sin llevarle", async ({ page }) => {
  await entrar(page, "1111");
  await page.getByRole("button", { name: "Ayuda" }).click();
  const dialogo = page.getByRole("dialog", { name: "Ayuda" });
  await dialogo.getByRole("searchbox").fill("subir los precios de toda la carta de golpe");
  const resumen = dialogo.locator("summary").filter({ hasText: "Subir o bajar precios de golpe" });
  await expect(resumen).toContainText("Esto lo hace el encargado.");
  const respuesta = dialogo.locator("details", {
    has: page.locator("summary", { hasText: "Subir o bajar precios de golpe" }),
  });
  await respuesta.evaluate((d) => ((d as HTMLDetailsElement).open = true));
  await expect(respuesta.getByText(/Cuánto \(%\)/)).toBeVisible();
  await expect(respuesta.getByRole("button", { name: "Llévame ahí" })).toHaveCount(0);
});

test("sin buscar, enseña todo el manual por temas y subtemas", async ({ page }) => {
  await entrar(page, "1111");
  await page.getByRole("button", { name: "Ayuda" }).click();
  const dialogo = page.getByRole("dialog", { name: "Ayuda" });
  await expect(dialogo.getByRole("heading", { name: "Todo, por temas" })).toBeVisible();
  const tema = dialogo.locator("summary").filter({ hasText: "Cobrar y cuentas" });
  await expect(tema).toContainText(/\d+ preguntas/);
  await tema.click();
  await expect(
    dialogo.getByRole("heading", { name: "Precios, descuentos e invitaciones" }),
  ).toBeVisible();
  const pregunta = dialogo
    .locator("summary")
    .filter({ hasText: "Cambiar el precio de un producto en una cuenta" })
    .last();
  await pregunta.click();
  await expect(dialogo.getByText(/Precio nuevo por unidad/).last()).toBeVisible();
  const axe = await new AxeBuilder({ page }).include("dialog").disableRules(["region"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});
