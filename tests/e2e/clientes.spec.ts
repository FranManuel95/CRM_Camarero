import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { entrar, listo, tokenDeMesa } from "./ayuda";

/** Manda una acción con la sesión de la página (para preparar lo que no se prueba aquí). */
async function accion(page: Page, accion: object) {
  const r = await page.request.post("/api/acciones", { data: { accion } });
  const datos = (await r.json()) as { error?: string };
  expect(datos.error).toBeUndefined();
}

const encender = (page: Page, funcion: string) =>
  accion(page, { tipo: "cambiar_funcion", funcion, activa: true });

/** «HH:MM» de Madrid dentro de `minutos`, o null si eso ya es mañana. */
function horaDentroDe(minutos: number): string | null {
  const formato = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(d);
  const ahora = formato(new Date());
  const luego = formato(new Date(Date.now() + minutos * 60_000));
  return ahora.slice(0, 10) === luego.slice(0, 10) ? luego.slice(-5) : null;
}

const mañana = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(
    new Date(Date.now() + 86_400_000),
  );

test("el camarero apunta un pedido para llevar y sale en la sala", async ({ page }, info) => {
  const nombre = `Lucía ${info.project.name}`;
  await entrar(page);
  await page.getByRole("button", { name: "Para llevar" }).click();
  await page.getByLabel("Nombre").fill(nombre);
  await page.getByRole("button", { name: "Apuntar y anotar lo que piden" }).click();
  await expect(page).toHaveURL(/\/sala\/llevar-sr-/);
  await expect(
    page.getByRole("heading", { name: new RegExp(`Para llevar · ${nombre}`) }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Cervezas" }).click();
  await page.getByRole("button", { name: /^Caña/ }).click();
  await page.getByRole("button", { name: /Mandar \(1\)/ }).click();
  await expect(page.getByText("Comanda mandada")).toBeVisible();

  await page.getByRole("link", { name: "Volver a la sala" }).click();
  await listo(page);
  const pedido = page
    .getByRole("region", { name: "Para llevar" })
    .getByRole("listitem")
    .filter({ hasText: nombre });
  await expect(pedido).toContainText("Preparando");
});

test("un cliente encarga para llevar desde el móvil y el bar lo acepta", async ({
  page,
  browser,
}, info) => {
  const nombre = `Óscar ${info.project.name}`;
  await entrar(page, "1234");
  await encender(page, "pedidosOnline");

  const contexto = await browser.newContext();
  const cliente = await contexto.newPage();
  await cliente.goto("/m/local/llevar");
  await expect(cliente.getByRole("heading", { name: "La Esquina" })).toBeVisible();
  const axeFormulario = await new AxeBuilder({ page: cliente }).analyze();
  expect(axeFormulario.violations.map((v) => v.id)).toEqual([]);
  await cliente.getByLabel("Tu nombre").fill(nombre);
  await cliente.getByLabel("Teléfono").fill("600 000 003");
  await cliente.getByLabel("Lo recojo a las").fill("23:59");
  await cliente.getByRole("button", { name: "Elegir de la carta" }).click();
  await expect(cliente).toHaveURL(/\/m\/local\/[\w-]+$/);
  await listo(cliente);
  await expect(cliente.getByText("Recoges a las 23:59")).toBeVisible();
  await expect(cliente.getByRole("button", { name: "Llamar camarero" })).toBeHidden();
  await cliente.getByRole("button", { name: "Añadir Croquetas de jamón (4 uds.)" }).click();
  await cliente.getByRole("button", { name: /Ver pedido \(1\)/ }).click();
  await cliente.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(cliente.getByText("¡Pedido enviado!")).toBeVisible();

  await page.goto("/sala");
  await listo(page);
  const pedido = page
    .getByRole("region", { name: "Para llevar" })
    .getByRole("listitem")
    .filter({ hasText: nombre });
  await expect(pedido).toContainText("Por aceptar");
  await pedido.getByRole("link", { name: "Abrir" }).click();
  await page.getByRole("button", { name: "Aceptar y mandar" }).click();
  await expect(page.getByText("Mandado a cocina y barra")).toBeVisible();

  await cliente.getByRole("button", { name: /Mi cuenta/ }).click();
  await expect(cliente.getByRole("dialog")).toContainText("Preparando");
  await expect(cliente.getByRole("dialog")).toContainText("Lo pagas al recogerlo.");
  const axeCarta = await new AxeBuilder({ page: cliente }).analyze();
  expect(axeCarta.violations.map((v) => v.id)).toEqual([]);
  await contexto.close();
});

test("reservas: desde la web, por teléfono y al llegar", async ({ page, browser }, info) => {
  const proyecto = info.project.name;
  await entrar(page, "1234");
  await encender(page, "reservasOnline");

  // Un cliente pide mesa para mañana desde la web del bar.
  const contexto = await browser.newContext();
  const cliente = await contexto.newPage();
  await cliente.goto("/m/local/reservar");
  await cliente.getByLabel("A nombre de").fill(`Web ${proyecto}`);
  await cliente.getByLabel("Teléfono").fill("600 000 009");
  await cliente.getByLabel("Personas").fill("3");
  await cliente.getByLabel("Día").fill(mañana());
  await cliente.getByLabel("Hora", { exact: true }).fill("21:00");
  const axe = await new AxeBuilder({ page: cliente }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await cliente.getByRole("button", { name: "Pedir la reserva" }).click();
  await expect(cliente.getByText("¡Petición enviada!")).toBeVisible();
  await contexto.close();

  // El bar la ve por confirmar y la confirma.
  await page.goto("/sala/reservas");
  await listo(page);
  const web = page
    .getByRole("region", { name: "Pedidas desde la web" })
    .getByRole("listitem")
    .filter({ hasText: `Web ${proyecto}` });
  await web.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Reserva confirmada")).toBeVisible();

  // Una por teléfono para dentro de un rato, en una mesa de la barra.
  const hora = horaDentroDe(40);
  test.skip(!hora, "Es casi medianoche: la reserva de prueba caería mañana.");
  const mesa = proyecto === "movil" ? "Barra 3" : "Barra 4";
  await page.getByRole("button", { name: "Nueva reserva" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("A nombre de").fill(`Tel ${proyecto}`);
  await dialogo.getByLabel("Personas").fill("1");
  await dialogo.getByLabel("Hora", { exact: true }).fill(hora!);
  await dialogo.getByLabel("Mesa").selectOption({ label: `${mesa} (1 plaza)` });
  await dialogo.getByRole("button", { name: "Apuntar la reserva" }).click();
  await expect(page.getByText("Reserva apuntada")).toBeVisible();
  const axeReservas = await new AxeBuilder({ page }).analyze();
  expect(axeReservas.violations.map((v) => v.id)).toEqual([]);

  // En el plano sale la reserva, y al llegar se abre la mesa.
  await page.goto("/sala");
  await listo(page);
  await page.getByRole("tab", { name: "Barra" }).click();
  const ficha = page.getByRole("button", { name: new RegExp(`^${mesa} ?,`) });
  await expect(ficha).toContainText(`Reserva ${hora}`);
  await ficha.click();
  await page.getByRole("button", { name: "Han llegado: abrir para 1" }).click();
  await expect(page.getByRole("heading", { name: mesa })).toBeVisible();
});

test("al pagar, la carta invita a dejar una reseña", async ({ page, browser }, info) => {
  const mesa = info.project.name === "movil" ? "Barra 1" : "Barra 2";
  await entrar(page, "1234");
  await encender(page, "resenas");
  await page.goto("/gestion/ajustes");
  await listo(page);
  await page.getByLabel("Enlace para dejar una reseña").fill("https://example.com/resena");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Ajustes guardados")).toBeVisible();

  // Se cobra la mesa (lo de cobrar ya tiene su propia prueba).
  const estado = async () =>
    (await (await page.request.get("/api/estado")).json()) as {
      mesas: { id: string; nombre: string }[];
      cuentas: { id: string; mesaId: string; estado: string }[];
    };
  const mesaId = (await estado()).mesas.find((m) => m.nombre === mesa)!.id;
  await accion(page, { tipo: "abrir_cuenta", mesaId, comensales: 1 });
  const cuentaId = (await estado()).cuentas.find(
    (c) => c.mesaId === mesaId && c.estado === "abierta",
  )!.id;
  await accion(page, {
    tipo: "anotar",
    cuentaId,
    lineas: [{ productoId: "prod-1-1", cantidad: 1, opciones: [], nota: "" }],
  });
  await accion(page, { tipo: "enviar_comanda", cuentaId });
  await accion(page, { tipo: "cobrar", cuentaId, pagos: [{ metodo: "tarjeta", importe: 200 }] });

  const contexto = await browser.newContext();
  const cliente = await contexto.newPage();
  await cliente.goto(`/m/local/${await tokenDeMesa(page, mesa)}`);
  await listo(cliente);
  await expect(cliente.getByRole("heading", { name: "¡Gracias!" })).toBeVisible();
  await expect(cliente.getByRole("link", { name: "¿Qué tal? Déjanos tu opinión" })).toHaveAttribute(
    "href",
    "https://example.com/resena",
  );
  await contexto.close();
});
