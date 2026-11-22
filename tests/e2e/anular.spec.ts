import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { entrar, listo } from "./ayuda";

type Estado = {
  ajustes: Record<string, unknown>;
  mesas: { id: string; nombre: string; virtual?: boolean }[];
  cuentas: {
    id: string;
    mesaId: string;
    estado: string;
    lineas: { id: string; nombre: string; cantidad: number; estado: string }[];
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

/** Una mesa libre con 3 de un producto y 1 de otro ya mandados a cocina/barra. */
async function mesaConComanda(page: Page, sufijo: string, indice: number, mandar = true) {
  const e = await leer(page);
  const ocupadas = new Set(e.cuentas.filter((c) => c.estado === "abierta").map((c) => c.mesaId));
  const mesa = e.mesas.filter((m) => !m.virtual && !ocupadas.has(m.id)).at(indice)!;
  const [uno, otro] = e.productos.filter((p) => p.disponible && !p.oculto && !p.grupos.length);
  const cuentaId = `sr-anular-${sufijo}-${Date.now().toString(36)}`;
  await accion(page, { tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2, cuentaId });
  await accion(page, {
    tipo: "anotar",
    cuentaId,
    lineas: [
      { productoId: uno!.id, cantidad: 3, opciones: [], nota: "" },
      { productoId: otro!.id, cantidad: 1, opciones: [], nota: "" },
    ],
  });
  if (mandar) await accion(page, { tipo: "enviar_comanda", cuentaId, imprimir: false });
  return { mesa, cuentaId, uno: uno!, otro: otro! };
}

test("se anulan unas unidades y otra línea de golpe, sin motivo", async ({ page }, info) => {
  await entrar(page, "1234");
  const { mesa, cuentaId, uno, otro } = await mesaConComanda(
    page,
    info.project.name,
    info.project.name === "movil" ? -1 : -2,
  );
  try {
    await page.goto(`/sala/${mesa.id}?abrir=cuenta`);
    await listo(page);
    await page.getByRole("button", { name: "Anular", exact: true }).first().click();
    const dialogo = page.getByRole("dialog", { name: "Anular" });
    await expect(dialogo.getByRole("checkbox", { name: `3× ${uno.nombre}` })).toBeChecked();
    await dialogo.getByRole("button", { name: `Una ${uno.nombre} menos para anular` }).click();
    await expect(dialogo.getByText("2 de 3")).toBeVisible();
    await dialogo.getByRole("checkbox", { name: `1× ${otro.nombre}` }).check();
    const axe = await new AxeBuilder({ page }).include("dialog").disableRules(["region"]).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await dialogo.getByRole("button", { name: /^Anular 3 ·/ }).click();
    await expect(dialogo).toBeHidden();

    const lineas = (await leer(page)).cuentas.find((c) => c.id === cuentaId)!.lineas;
    const anuladas = lineas.filter((l) => l.estado === "anulada");
    expect(anuladas.map((l) => [l.nombre, l.cantidad])).toEqual([
      [uno.nombre, 2],
      [otro.nombre, 1],
    ]);
    expect(lineas.find((l) => l.estado !== "anulada")).toMatchObject({
      nombre: uno.nombre,
      cantidad: 1,
    });
  } finally {
    await accion(page, { tipo: "anular_cuenta", cuentaId });
  }
});

test("si el bar lo pide, al mandar se elige con papel o solo en pantalla", async ({
  page,
}, info) => {
  await entrar(page, "1234");
  const antes = (await leer(page)).ajustes;
  const ajustes = (preguntarPapel: boolean) =>
    accion(page, { tipo: "guardar_ajustes", ajustes: { ...antes, preguntarPapel } });
  await ajustes(true);
  const { mesa, cuentaId } = await mesaConComanda(
    page,
    `papel-${info.project.name}`,
    info.project.name === "movil" ? -3 : -4,
    false,
  );
  try {
    await page.goto(`/sala/${mesa.id}?abrir=cuenta`);
    await listo(page);
    await expect(page.getByText(/Comanda en papel:/)).toHaveCount(0);
    await page
      .getByRole("button", { name: /^Mandar/ })
      .last()
      .click();
    const dialogo = page.getByRole("dialog", { name: "¿Cómo lo mandas?" });
    await expect(dialogo.getByRole("button", { name: /Con papel/ })).toBeVisible();
    await dialogo.getByRole("button", { name: /Solo en pantalla/ }).click();
    await expect(page.getByText("Mandada a pantalla (sin papel)")).toBeVisible();
    const lineas = (await leer(page)).cuentas.find((c) => c.id === cuentaId)!.lineas;
    expect(lineas.every((l) => l.estado !== "anotada")).toBe(true);
  } finally {
    await accion(page, { tipo: "anular_cuenta", cuentaId });
    await ajustes(false);
  }
});
