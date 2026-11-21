import { writeFileSync } from "node:fs";
import path from "node:path";
import { test, type Browser, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { MANUAL, datosQuePide, rutaCon, type EntradaAyuda } from "../../src/lib/ayuda";
import { LISTA_FUNCIONES } from "../../src/lib/dominio/funciones";
import { entrar } from "../e2e/ayuda";

/** Pantallas que se ven sin entrar con PIN. */
const PUBLICAS = ["/entrar", "/acceder", "/registro", "/legal", "/mis-bares", "/admin"];
const CARPETA = path.join(process.cwd(), "public", "ayuda");
const MANIFIESTO = path.join(process.cwd(), "src", "lib", "ayuda", "capturas.json");

type Estado = {
  mesas: { id: string; token: string; virtual?: boolean }[];
  categorias: { id: string }[];
  cartas?: { id: string }[];
  cuentas: { id: string; mesaId: string; estado: string; lineas: { id: string }[] }[];
  productos: {
    id: string;
    precio: number;
    disponible: boolean;
    oculto?: boolean;
    grupos: unknown[];
  }[];
  clientes?: { id: string }[];
};

async function accion(page: Page, a: { tipo: string; [k: string]: unknown }) {
  const r = await page.request.post("/api/acciones", { data: { accion: a } });
  if (!r.ok()) console.log(`✗ ${a.tipo}: ${(await r.text()).slice(0, 200)}`);
}
const leer = async (page: Page) => (await (await page.request.get("/api/estado")).json()) as Estado;

/** Las pestañas de la barra de arriba: no explican nada, se saltan. */
const BARRA = new Set(["Sala", "Cocina", "Barra", "Caja", "Gestión", "Ayuda", "Fichar", "Salir"]);

/** Lo que hay que señalar: el de la entrada o los textos entre «» de los pasos, en orden. */
function citas(e: EntradaAyuda): string[] {
  if (e.captura && e.captura.marca) return [e.captura.marca];
  const todas = e.pasos.flatMap((p) => [...p.matchAll(/«([^»]+)»/g)].map((m) => m[1]!));
  return [...new Set(todas)].filter((c) => /\p{L}/u.test(c) && !BARRA.has(c));
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * El elemento visible que lleva ese texto: primero botones, enlaces y campos; los títulos solo
 * si no hay otra cosa. Nunca la barra de arriba (la pestaña «Sala» no explica nada).
 */
async function buscar(zona: Locator | Page, texto: string, titulos: boolean) {
  const recortado = texto.replace(/\s*…\s*$/, "");
  const exacto = !texto.endsWith("…");
  const nombre = exacto ? texto : new RegExp(`^${escapar(recortado)}`);
  const roles = ["button", "link", "tab", "checkbox", "radio", "switch", "combobox"] as const;
  const opciones = titulos
    ? [zona.getByRole("heading", { name: nombre, exact: exacto })]
    : [
        ...roles.map((rol) => zona.getByRole(rol, { name: nombre, exact: exacto })),
        zona.getByLabel(nombre, { exact: exacto }),
        zona.getByPlaceholder(nombre, { exact: exacto }),
        zona.getByText(nombre, { exact: exacto }),
      ];
  for (const o of opciones) {
    const visibles = o.filter({ visible: true });
    const n = Math.min(await visibles.count().catch(() => 0), 10);
    for (let i = 0; i < n; i++) {
      const el = visibles.nth(i);
      const vale = await el
        .evaluate(
          (nodo) =>
            !nodo.closest("nav, header.no-imprimir") &&
            nodo.getBoundingClientRect().height < window.innerHeight * 0.3,
        )
        .catch(() => false);
      if (vale) return el;
    }
  }
  return null;
}

/** Recuadra el elemento y oscurece el resto (dentro del diálogo si lo hay: va por encima). */
async function senalar(el: Locator) {
  // Al centro: arriba lo taparía la barra fija.
  await el.evaluate((n) => n.scrollIntoView({ block: "center", inline: "nearest" }));
  await el.page().waitForTimeout(150);
  await el.evaluate((nodo) => {
    const r = nodo.getBoundingClientRect();
    const marco = document.createElement("div");
    marco.setAttribute("data-captura", "");
    Object.assign(marco.style, {
      position: "fixed",
      left: `${r.left - 6}px`,
      top: `${r.top - 6}px`,
      width: `${r.width + 12}px`,
      height: `${r.height + 12}px`,
      border: "4px solid #f97316",
      borderRadius: "14px",
      boxShadow: "0 0 0 9999px rgba(15, 15, 20, 0.35)",
      pointerEvents: "none",
      zIndex: "2147483647",
    });
    (nodo.closest("dialog[open]") ?? document.body).appendChild(marco);
  });
}

test("capturas de la ayuda", async ({ browser }) => {
  test.setTimeout(20 * 60_000);
  const nueva = async (b: Browser) =>
    b.newPage({
      viewport: { width: 412, height: 839 },
      deviceScaleFactor: 1.5,
      isMobile: true,
      hasTouch: true,
    });
  const encargado = await nueva(browser);
  const camarero = await nueva(browser);
  const fuera = await nueva(browser);
  await entrar(encargado, "1234");
  await entrar(camarero, "1111");

  // Datos para que las pantallas no salgan vacías: todo encendido, una mesa con su cuenta y un
  // cliente del club. Todo ficticio.
  for (const funcion of LISTA_FUNCIONES)
    await accion(encargado, { tipo: "cambiar_funcion", funcion, activa: true });
  let e = await leer(encargado);
  const libres = e.mesas.filter((m) => !m.virtual && !e.cuentas.some((c) => c.mesaId === m.id));
  const mesa = libres[0]!.id;
  const platos = e.productos.filter((p) => p.disponible && !p.oculto && !p.grupos.length);
  const cuentaId = "sr-captura-ayuda";
  await accion(encargado, { tipo: "abrir_cuenta", mesaId: mesa, comensales: 2, cuentaId });
  await accion(encargado, {
    tipo: "anotar",
    cuentaId,
    lineas: platos
      .slice(0, 3)
      .map((p) => ({ productoId: p.id, cantidad: 1, opciones: [], nota: "" })),
  });
  await accion(encargado, {
    tipo: "guardar_cliente",
    cliente: {
      nombre: "Lucía Ejemplo",
      telefono: "600 000 000",
      correo: "",
      alergenos: [],
      comunicaciones: false,
      nota: "",
    },
    consentimiento: true,
  });
  // Otra mesa ya mandada a cocina, otra con un pedido desde el QR y una carta de comidas.
  const enviada = libres[1]!.id;
  await accion(encargado, {
    tipo: "abrir_cuenta",
    mesaId: enviada,
    comensales: 2,
    cuentaId: "sr-captura-enviada",
  });
  await accion(encargado, {
    tipo: "anotar",
    cuentaId: "sr-captura-enviada",
    lineas: platos
      .slice(3, 5)
      .map((p) => ({ productoId: p.id, cantidad: 1, opciones: [], nota: "" })),
  });
  await accion(encargado, {
    tipo: "asignar_cliente",
    cuentaId: "sr-captura-enviada",
    clienteId: (await leer(encargado)).clientes?.[0]?.id ?? null,
  });
  await accion(encargado, { tipo: "enviar_comanda", cuentaId: "sr-captura-enviada" });
  const qr = libres[2]!;
  await fuera.request.post(`/api/mesa/local/${qr.token}`, {
    data: {
      tipo: "pedir",
      lineas: [{ productoId: platos[5]!.id, cantidad: 2, opciones: [], nota: "" }],
    },
  });
  await accion(encargado, {
    tipo: "guardar_carta_horaria",
    carta: { nombre: "Comidas", categoriaIds: e.categorias.slice(4).map((c) => c.id) },
  });
  // Y un ticket cobrado, para la lista de tickets de la caja.
  await accion(encargado, {
    tipo: "abrir_cuenta",
    mesaId: libres[3]!.id,
    comensales: 1,
    cuentaId: "sr-captura-cobrada",
  });
  await accion(encargado, {
    tipo: "anotar",
    cuentaId: "sr-captura-cobrada",
    lineas: [{ productoId: platos[0]!.id, cantidad: 1, opciones: [], nota: "" }],
  });
  await accion(encargado, { tipo: "enviar_comanda", cuentaId: "sr-captura-cobrada" });
  await accion(encargado, {
    tipo: "cobrar",
    cuentaId: "sr-captura-cobrada",
    pagos: [{ metodo: "efectivo", importe: platos[0]!.precio }],
  });
  e = await leer(encargado);
  const extra = { enviada, qr: qr.id };
  const datos = {
    mesa,
    linea: e.cuentas.find((c) => c.id === cuentaId)!.lineas[0]!.id,
    producto: platos[0]!.id,
    cliente: e.clientes?.[0]?.id ?? "",
  };

  const manifiesto: Record<string, string | null> = {};
  for (const entrada of MANUAL) {
    if (entrada.captura === false) continue;
    const ajuste = entrada.captura ?? {};
    const destino = (ajuste.ruta ?? entrada.ruta)?.replace(
      /\{(enviada|qr)\}/g,
      (_, d: keyof typeof extra) => extra[d],
    );
    if (!destino || datosQuePide(destino).some((d) => !datos[d])) continue;
    const ruta = rutaCon(destino, datos);
    const camino = ruta.split(/[?#]/)[0]!;
    const page = PUBLICAS.includes(camino)
      ? fuera
      : entrada.quien === "equipo"
        ? camarero
        : encargado;
    try {
      await page.goto(ruta, { timeout: 20_000 });
      if (page !== fuera)
        await page
          .locator("html[data-conectado]")
          .waitFor({ state: "attached", timeout: 8_000 })
          .catch(() => {});
      await page.waitForTimeout(700);
      if (new URL(page.url()).pathname !== camino) {
        console.log(`✗ ${entrada.id}: acaba en ${page.url()}`);
        continue;
      }
      if (ajuste.clic) {
        const el = await buscar(page, ajuste.clic, false);
        await el?.click();
        await page.waitForTimeout(500);
      }
      if (await page.getByText("Aquí no hay nada").count()) {
        console.log(`✗ ${entrada.id}: no existe aquí`);
        continue;
      }
      const dialogo = page.locator("dialog[open]").last();
      const zona = (await dialogo.count()) ? dialogo : page;
      let marca: string | null = null;
      buscando: for (const titulos of [false, true])
        for (const cita of citas(entrada)) {
          const el = await buscar(zona, cita, titulos);
          if (el) {
            await senalar(el);
            marca = cita;
            break buscando;
          }
        }
      if (ajuste.marca && !marca) console.log(`✗ ${entrada.id}: sin «${ajuste.marca}»`);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const png = await page.screenshot();
      await sharp(png)
        .webp({ quality: 68 })
        .toFile(path.join(CARPETA, `${entrada.id}.webp`));
      manifiesto[entrada.id] = marca;
      console.log(`${marca ? "✓" : "·"} ${entrada.id}${marca ? ` → «${marca}»` : ""}`);
    } catch (error) {
      console.log(`✗ ${entrada.id}: ${(error as Error).message.split("\n")[0]}`);
    } finally {
      await page.locator("[data-captura]").evaluateAll((ns) => ns.forEach((n) => n.remove()));
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
  e = await leer(encargado);
  for (const c of e.cuentas.filter(
    (c) => c.estado === "abierta" && [mesa, enviada, qr.id].includes(c.mesaId),
  ))
    await accion(encargado, { tipo: "anular_cuenta", cuentaId: c.id });
  for (const c of e.cartas ?? [])
    await accion(encargado, { tipo: "borrar_carta_horaria", cartaId: c.id });
  writeFileSync(MANIFIESTO, `${JSON.stringify(manifiesto, null, 2)}\n`);
});
