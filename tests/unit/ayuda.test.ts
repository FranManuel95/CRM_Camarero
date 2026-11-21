import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { accionCamarero, accionCliente, accionEncargado } from "@/lib/dominio/acciones";
import { LISTA_FUNCIONES } from "@/lib/dominio/funciones";
import { buscarAyuda, MANUAL, rutaCon, datosQuePide, TEMAS } from "@/lib/ayuda";
import type { QuienPregunta } from "@/lib/ayuda";

type Union = { options: readonly { shape: { tipo: { value: string } } }[] };
const tipos = (u: unknown) => (u as Union).options.map((o) => o.shape.tipo.value);
const CAMARERO = tipos(accionCamarero);
const ENCARGADO = tipos(accionEncargado);
const CLIENTE = tipos(accionCliente);
/** Lo que hacen los clientes por sus propias páginas (no son acciones de las pantallas del equipo). */
const PUBLICAS = ["alta_club", "encargo_online", "reserva_online"];
const TODAS = [...CAMARERO, ...ENCARGADO, ...CLIENTE, ...PUBLICAS];

/** Las pantallas de la app, como rutas: «/sala/[mesaId]». */
const raiz = path.join(process.cwd(), "src/app");
const PANTALLAS = (readdirSync(raiz, { recursive: true }) as string[])
  .filter((f) => f.endsWith(`${path.sep}page.tsx`) || f === "page.tsx")
  .map(
    (f) =>
      "/" +
      path
        .dirname(f)
        .split(path.sep)
        .filter((p) => p !== "." && !/^\(.*\)$/.test(p))
        .join("/"),
  )
  .map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")));

/** Las funciones del servidor: «/api/mesa/[local]/[token]». */
const APIS = (readdirSync(path.join(raiz, "api"), { recursive: true }) as string[])
  .filter((f) => f.endsWith("route.ts"))
  .map(
    (f) =>
      "/api/" +
      path
        .dirname(f)
        .split(path.sep)
        .filter((p) => p !== ".")
        .join("/"),
  )
  .map((r) => r.replace(/\/$/, ""));
/** Las que no hacen nada visible por sí solas: datos en directo, salud, errores y las acciones. */
const APIS_INTERNAS = [
  "/api/acciones",
  "/api/estado",
  "/api/eventos",
  "/api/mesa/[local]/[token]/eventos",
  "/api/errores",
  "/api/salud",
];

const comoRegex = (pantalla: string) => new RegExp(`^${pantalla.replace(/\[[^\]]+\]/g, "[^/]+")}$`);
const pantallaDe = (ruta: string) => {
  const limpia = ruta.replace(/\{[a-z]+\}/g, "x").split(/[?#]/)[0]!;
  return PANTALLAS.find((p) => comoRegex(p).test(limpia));
};

describe("manual de la app", () => {
  it("cada entrada tiene lo básico y los ids no se repiten", () => {
    const ids = MANUAL.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of MANUAL) {
      expect(e.titulo.length, e.id).toBeGreaterThan(5);
      expect(e.preguntas.length, e.id).toBeGreaterThan(0);
      expect(e.pasos.length, e.id).toBeGreaterThan(0);
      for (const v of e.ver ?? []) expect(ids, `${e.id} → ${v}`).toContain(v);
    }
  });

  it("el índice por temas tiene TODAS las preguntas, cada una en un solo sitio", () => {
    const enIndice = TEMAS.flatMap((t) => t.subtemas.flatMap((s) => s.entradas));
    const ids = MANUAL.map((e) => e.id);
    const repetidas = enIndice.filter((id, i) => enIndice.indexOf(id) !== i);
    expect(repetidas, "Preguntas en dos sitios del índice").toEqual([]);
    expect(
      enIndice.filter((id) => !ids.includes(id)),
      "En el índice pero no en el manual",
    ).toEqual([]);
    expect(
      ids.filter((id) => !enIndice.includes(id)),
      "Preguntas que faltan en el índice",
    ).toEqual([]);
    for (const t of TEMAS)
      for (const s of t.subtemas) expect(s.entradas.length, s.nombre).toBeGreaterThan(0);
  });

  it("explica TODAS las acciones de la app, y no nombra ninguna que no exista", () => {
    const explicadas = new Set(MANUAL.flatMap((e) => e.acciones ?? []));
    const faltan = TODAS.filter((t) => !explicadas.has(t));
    expect(faltan, "Acciones sin entrada en el manual").toEqual([]);
    const inventadas = [...explicadas].filter((t) => !TODAS.includes(t));
    expect(inventadas, "Acciones del manual que no existen").toEqual([]);
  });

  it("explica TODAS las pantallas, y sus enlaces llevan a pantallas que existen", () => {
    expect(PANTALLAS.length).toBeGreaterThan(30);
    const cubiertas = new Set<string>();
    for (const e of MANUAL) {
      for (const p of e.pantallas ?? []) {
        expect(PANTALLAS, `${e.id}: pantalla ${p}`).toContain(p);
        cubiertas.add(p);
      }
      if (e.ruta) {
        const p = pantallaDe(e.ruta);
        expect(p, `${e.id}: la ruta ${e.ruta} no lleva a ninguna pantalla`).toBeDefined();
        cubiertas.add(p!);
      }
    }
    // La portada y la página de error no necesitan explicación.
    const faltan = PANTALLAS.filter((p) => !cubiertas.has(p) && p !== "/");
    expect(faltan, "Pantallas sin entrada en el manual").toEqual([]);
  });

  it("explica TODO lo que hace el servidor (salvo lo interno), sin nombrar nada que no exista", () => {
    expect(APIS.length).toBeGreaterThan(25);
    const explicadas = new Set(MANUAL.flatMap((e) => e.apis ?? []));
    const faltan = APIS.filter((a) => !explicadas.has(a) && !APIS_INTERNAS.includes(a));
    expect(faltan, "Funciones del servidor sin entrada en el manual").toEqual([]);
    const inventadas = [...explicadas, ...APIS_INTERNAS].filter((a) => !APIS.includes(a));
    expect(inventadas, "Funciones del servidor que no existen").toEqual([]);
  });

  it("explica TODAS las funciones que se pueden encender", () => {
    const explicadas = new Set(MANUAL.flatMap((e) => [e.funcion, ...(e.funciones ?? [])]));
    const faltan = LISTA_FUNCIONES.filter((f) => !explicadas.has(f));
    expect(faltan, "Funciones sin entrada en el manual").toEqual([]);
  });

  it("no manda a un camarero a lo que solo puede hacer el encargado", () => {
    for (const e of MANUAL.filter((x) => x.quien === "equipo")) {
      for (const a of e.acciones ?? [])
        expect(ENCARGADO, `${e.id} es «equipo» pero ${a} es solo del encargado`).not.toContain(a);
      expect(e.ruta?.startsWith("/gestion") ?? false, `${e.id} lleva a Gestión`).toBe(false);
    }
  });

  it("los enlaces con datos piden solo datos conocidos y no salen de la app", () => {
    for (const e of MANUAL.filter((x) => x.ruta)) {
      const pide = datosQuePide(e.ruta);
      const sinDatos = e.ruta!.replace(/\{(mesa|linea|producto|cliente)\}/g, "");
      expect(sinDatos, e.id).not.toMatch(/[{}]/);
      if (pide.includes("linea"))
        expect(pide, `${e.id}: una línea va con su mesa`).toContain("mesa");
      const hecha = rutaCon(e.ruta!, { mesa: "m1", linea: "l1", producto: "p1", cliente: "c1" });
      expect(hecha.startsWith("/") && !hecha.startsWith("//"), e.id).toBe(true);
    }
    expect(() => rutaCon("//otra-web.example", {})).toThrow();
  });
});

describe("buscador de la ayuda", () => {
  const camarero: QuienPregunta = { rol: "camarero", puede: () => true, activa: () => true };
  const primero = (q: string, quien?: QuienPregunta) =>
    buscarAyuda(MANUAL, q, quien)[0]?.entrada.id;
  const entre = (q: string, n = 3) =>
    buscarAyuda(MANUAL, q)
      .slice(0, n)
      .map((r) => r.entrada.id);

  it("encuentra la respuesta a las dudas típicas", () => {
    expect(entre("cómo le subo el precio a un producto cuando voy a cobrar")).toContain(
      "precio-linea",
    );
    expect(entre("se lo puedo subir a todos los precios de la carta")).toContain("subir-precios");
    expect(primero("cómo cierro la caja")).toBe("cerrar-caja");
    expect(entre("vincular el móvil de un camarero")).toContain("vincular");
    expect(entre("se ha ido el wifi")).toContain("sin-wifi");
    expect(entre("dar de alta un camarero nuevo")).toContain("equipo");
    expect(entre("cómo creo un bar nuevo")).toContain("alta-bar");
    expect(entre("la impresora no imprime")).toContain("impresora-falla");
    expect(entre("cada uno paga lo suyo")).toContain("cobrar-partes");
    expect(entre("happy hour")).toContain("tarifas");
    expect(buscarAyuda(MANUAL, "")).toEqual([]);
  });

  it("al camarero le dice quién puede hacer lo que no le toca", () => {
    const r = buscarAyuda(MANUAL, "subir precios de golpe a toda la carta", camarero);
    const subir = r.find((x) => x.entrada.id === "subir-precios");
    expect(subir?.aviso).toBe("Esto lo hace el encargado.");
    const sinPermiso: QuienPregunta = { ...camarero, puede: (p) => p !== "anular" };
    const anular = buscarAyuda(MANUAL, "anular un plato que ya está en cocina", sinPermiso).find(
      (x) => x.entrada.id === "anular-linea",
    );
    expect(anular?.aviso).toMatch(/permiso/);
    const apagado: QuienPregunta = { ...camarero, activa: (f) => f !== "reservas" };
    const reserva = buscarAyuda(MANUAL, "apuntar una reserva", apagado).find(
      (x) => x.entrada.id === "reservas",
    );
    expect(reserva?.aviso).toMatch(/Funciones/);
  });
});
