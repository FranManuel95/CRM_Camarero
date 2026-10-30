import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { buscarEnGestion } from "@/lib/dominio/buscador";
import { extrasDelTurno, turnoAbierto } from "@/lib/dominio/caja";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { puede } from "@/lib/dominio/permisos";
import { precioNuevo, propuestaPrecios } from "@/lib/dominio/precios-carta";
import { masPedidos } from "@/lib/dominio/rapidos";
import { cuentaDeMesa, reducirPersonal } from "@/lib/dominio/reducir";
import { resumenDelDia, resumenEnTexto } from "@/lib/dominio/resumen-diario";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { contexto } from "./ayuda";

const ctx = contexto();
const CAÑA = "prod-1-1";
const linea = (productoId: string, cantidad = 1) => ({
  productoId,
  cantidad,
  opciones: [],
  nota: "",
});

function preparar(conHistorial = false) {
  let estado: Estado = estadoDeEjemplo(ctx, { conHistorial });
  const [ana, luis] = estado.empleados as [Empleado, Empleado];
  const hacer = (accion: AccionPersonal, quien = ana) => {
    const r = reducirPersonal(estado, accion, quien, ctx);
    estado = r.estado;
    return r;
  };
  return {
    get estado() {
      return estado;
    },
    hacer,
    ana,
    luis,
  };
}

describe("subir precios de golpe", () => {
  it("aplica el % y redondea", () => {
    expect(precioNuevo(235, 5, 10)).toBe(250);
    expect(precioNuevo(200, 5, 0)).toBe(210);
    expect(precioNuevo(650, -10, 5)).toBe(585);
    expect(precioNuevo(1000, 3, 50)).toBe(1050);
  });

  it("cambia solo las categorías elegidas y no deja hacerlo a un camarero", () => {
    const t = preparar();
    const cervezas = t.estado.productos.find((p) => p.id === CAÑA)!.categoriaId;
    const otras = t.estado.productos.filter((p) => p.categoriaId !== cervezas);
    const propuesta = propuestaPrecios(t.estado, [cervezas], 10, 10);
    expect(propuesta.length).toBeGreaterThan(0);
    expect(() =>
      reducirPersonal(
        t.estado,
        { tipo: "subir_precios", categoriaIds: [cervezas], porcentaje: 10, redondeo: 10 },
        t.luis,
        ctx,
      ),
    ).toThrow();
    t.hacer({ tipo: "subir_precios", categoriaIds: [cervezas], porcentaje: 10, redondeo: 10 });
    expect(t.estado.productos.find((p) => p.id === CAÑA)!.precio).toBe(220);
    for (const p of otras)
      expect(t.estado.productos.find((x) => x.id === p.id)!.precio).toBe(p.precio);
    expect(t.estado.historial.at(-1)!.texto).toContain("+10 %");
  });
});

describe("permisos por persona", () => {
  it("por defecto el camarero puede todo menos lo que el bar reserva al encargado", () => {
    const t = preparar();
    expect(puede(t.estado.ajustes, t.luis, "cobrar")).toBe(true);
    expect(puede({ preciosSoloEncargado: true }, t.luis, "descuentos")).toBe(false);
    expect(puede({ preciosSoloEncargado: true }, t.ana, "descuentos")).toBe(true);
  });

  it("sin permiso de cobrar ni invitar, el camarero no puede hacerlo", () => {
    const t = preparar();
    const { pin: _p, ...luis } = t.luis;
    void _p;
    t.hacer({
      tipo: "guardar_empleado",
      empleado: { ...luis, pin: "", permisos: { cobrar: false, invitar: false } },
    });
    const yo = t.estado.empleados.find((e) => e.id === t.luis.id)!;
    t.hacer({ tipo: "abrir_caja", fondoInicial: 0 });
    const mesa = t.estado.mesas.find((m) => m.nombre === "Mesa 5")!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2 }, yo);
    const cuentaId = cuentaDeMesa(t.estado, mesa.id)!.id;
    t.hacer({ tipo: "anotar", cuentaId, lineas: [linea(CAÑA)] }, yo);
    t.hacer({ tipo: "enviar_comanda", cuentaId }, yo);
    const lineaId = cuentaDeMesa(t.estado, mesa.id)!.lineas[0]!.id;
    expect(() =>
      reducirPersonal(
        t.estado,
        { tipo: "invitar_linea", cuentaId, lineaId, invitacion: true },
        yo,
        ctx,
      ),
    ).toThrow(/no lo tienes permitido/);
    expect(() =>
      reducirPersonal(
        t.estado,
        { tipo: "cobrar", cuentaId, pagos: [{ metodo: "efectivo", importe: 200 }] },
        yo,
        ctx,
      ),
    ).toThrow(/no lo tienes permitido/);
    // El encargado sí.
    t.hacer({ tipo: "cobrar", cuentaId, pagos: [{ metodo: "efectivo", importe: 200 }] });
  });
});

describe("distribuciones del plano", () => {
  it("se guarda, se cambia el plano y se vuelve a ella", () => {
    const t = preparar();
    const mesa = t.estado.mesas[0]!;
    t.hacer({ tipo: "guardar_plano", nombre: "Invierno" });
    const { token: _t, ...datos } = mesa;
    void _t;
    t.hacer({ tipo: "guardar_mesa", mesa: { ...datos, x: 70, y: 70 } });
    t.hacer({ tipo: "borrar_decoracion", decoracionId: t.estado.decoraciones![0]!.id });
    const plano = t.estado.planos![0]!;
    t.hacer({ tipo: "usar_plano", planoId: plano.id });
    expect(t.estado.mesas[0]).toMatchObject({ x: mesa.x, y: mesa.y });
    expect(t.estado.decoraciones).toHaveLength(plano.decoraciones.length);
    // Con el mismo nombre, se pisa.
    t.hacer({ tipo: "guardar_plano", nombre: "invierno" });
    expect(t.estado.planos).toHaveLength(1);
  });
});

describe("carta desde una foto", () => {
  it("crea lo nuevo y no duplica lo que ya hay", () => {
    const t = preparar();
    const antes = t.estado.productos.length;
    const caña = t.estado.productos.find((p) => p.id === CAÑA)!;
    const cervezas = t.estado.categorias.find((c) => c.id === caña.categoriaId)!;
    t.hacer({
      tipo: "importar_carta",
      categorias: [
        {
          nombre: cervezas.nombre.toUpperCase(),
          destino: "barra",
          productos: [
            { nombre: caña.nombre, descripcion: "", precio: 999, alergenos: [] },
            { nombre: "Cerveza de trigo", descripcion: "", precio: 350, alergenos: ["gluten"] },
          ],
        },
        {
          nombre: "Postres caseros",
          destino: "cocina",
          productos: [
            {
              nombre: "Flan",
              descripcion: "De la abuela",
              precio: 450,
              alergenos: ["huevo", "lacteos"],
            },
          ],
        },
      ],
    });
    expect(t.estado.productos).toHaveLength(antes + 2);
    expect(t.estado.productos.find((p) => p.id === CAÑA)!.precio).toBe(caña.precio);
    expect(t.estado.categorias.some((c) => c.nombre === "Postres caseros")).toBe(true);
    expect(t.estado.productos.find((p) => p.nombre === "Cerveza de trigo")!.categoriaId).toBe(
      cervezas.id,
    );
  });
});

describe("rápidos, buscador, cierre y resumen diario (con el historial de ejemplo)", () => {
  const t = preparar(true);

  it("propone lo más pedido", () => {
    const rapidos = masPedidos(t.estado.tickets, ctx.ahora);
    expect(rapidos.length).toBeGreaterThanOrEqual(4);
    expect(rapidos.every((n) => t.estado.productos.some((p) => p.nombre === n))).toBe(true);
  });

  it("el buscador encuentra productos sin tildes, tickets por número y secciones", () => {
    const enCarta = buscarEnGestion(t.estado, "cana");
    expect(enCarta.some((r) => r.grupo === "Carta" && r.texto.startsWith("Caña"))).toBe(true);
    const ticket = t.estado.tickets.at(-1)!;
    const porNumero = buscarEnGestion(t.estado, String(ticket.secuencia));
    expect(porNumero.some((r) => r.ticket?.id === ticket.id)).toBe(true);
    expect(buscarEnGestion(t.estado, "nif")[0]).toMatchObject({ texto: "Ajustes" });
    expect(buscarEnGestion(t.estado, "x")).toEqual([]);
  });

  it("el cierre resume anulaciones y lo más vendido del turno", () => {
    const turno = turnoAbierto(t.estado)!;
    const extras = extrasDelTurno(t.estado, turno);
    expect(extras.anulaciones.cantidad).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(extras.masVendido)).toBe(true);
  });

  it("el resumen de ayer trae ventas, caja y lo más vendido", () => {
    const ayer = new Date(Date.parse(ctx.ahora) - 86_400_000).toISOString().slice(0, 10);
    const r = resumenDelDia(t.estado, ayer);
    const texto = resumenEnTexto(r);
    expect(r.asunto).toContain(t.estado.ajustes.nombreLocal);
    expect(texto).toContain("VENTAS");
    expect(texto).toContain("CAJA");
  });
});

describe("el bar no crece con el tiempo", () => {
  it("olvida las cuentas cerradas hace días y lo impreso hace más de un día", () => {
    const t = preparar();
    const viejo = new Date(Date.parse(ctx.ahora) - 3 * 86_400_000).toISOString();
    t.estado.cuentas.push({
      ...structuredClone(t.estado.cuentas[0] ?? ({} as never)),
      id: "vieja",
      estado: "cobrada",
      cerradaEn: viejo,
    });
    t.estado.trabajos.push({
      id: "impreso-viejo",
      creadoEn: viejo,
      tipo: "ticket",
      impresoraId: null,
      titulo: "Ticket",
      documento: [],
      estado: "impreso",
    });
    t.hacer({ tipo: "guardar_plano", nombre: "Cualquiera" });
    expect(t.estado.cuentas.some((c) => c.id === "vieja")).toBe(false);
    expect(t.estado.trabajos.some((x) => x.id === "impreso-viejo")).toBe(false);
  });
});
