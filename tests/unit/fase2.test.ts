import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { resumenTurno, turnoAbierto } from "@/lib/dominio/caja";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { dentroDeHorario, describirHorario } from "@/lib/dominio/horario";
import { verificarCadena } from "@/lib/dominio/huella";
import { pagadoCuenta, totalCuenta } from "@/lib/dominio/importes";
import { informe, rangoDeDias } from "@/lib/dominio/informes";
import { cuentaDeMesa, reducirCliente, reducirPersonal } from "@/lib/dominio/reducir";
import { cuentaEnJuego, pedidosCocina } from "@/lib/dominio/selectores";
import type { Estado } from "@/lib/dominio/tipos";
import { aTexto } from "@/lib/impresion/documento";
import { vistaCliente } from "@/lib/servidor/vistas";
import { contexto } from "./ayuda";

const ctx = contexto();

function preparar() {
  let estado: Estado = estadoDeEjemplo(ctx);
  const ana = estado.empleados[0]!;
  const hacer = (accion: AccionPersonal) => {
    const r = reducirPersonal(estado, accion, ana, ctx);
    estado = r.estado;
    return r;
  };
  hacer({ tipo: "abrir_caja", fondoInicial: 0 });
  const mesa = estado.mesas.find((m) => m.nombre === "Mesa 1")!;
  hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 3 });
  const cuentaId = cuentaDeMesa(estado, mesa.id)!.id;
  return {
    get estado() {
      return estado;
    },
    set estado(e: Estado) {
      estado = e;
    },
    hacer,
    mesa,
    cuentaId,
    cuenta: () => estado.cuentas.find((c) => c.id === cuentaId)!,
  };
}

const linea = (productoId: string, cantidad = 1, extra: object = {}) => ({
  productoId,
  cantidad,
  opciones: [],
  nota: "",
  ...extra,
});

describe("cobrar por partes", () => {
  it("cobra solo lo de uno, parte las líneas y cierra al pagar lo último", () => {
    const t = preparar();
    t.hacer({
      tipo: "anotar",
      cuentaId: t.cuentaId,
      lineas: [linea("prod-1-1", 3), linea("prod-5-2")],
    });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    const [canas, bravas] = t.cuenta().lineas;
    expect(totalCuenta(t.cuenta())).toBe(600 + 550);

    // Uno paga una caña y las bravas.
    t.hacer({
      tipo: "cobrar",
      cuentaId: t.cuentaId,
      pagos: [{ metodo: "efectivo", importe: 1000 }],
      partes: [
        { lineaId: canas!.id, cantidad: 1 },
        { lineaId: bravas!.id, cantidad: 1 },
      ],
    });
    expect(t.estado.tickets.at(-1)).toMatchObject({ total: 750, cambio: 250 });
    expect(t.cuenta().estado).toBe("abierta");
    expect(totalCuenta(t.cuenta())).toBe(400);
    expect(pagadoCuenta(t.cuenta())).toBe(750);
    expect(
      t
        .cuenta()
        .lineas.filter((l) => l.productoId === "prod-1-1")
        .map((l) => l.cantidad),
    ).toEqual([2, 1]);

    expect(() =>
      t.hacer({
        tipo: "cobrar",
        cuentaId: t.cuentaId,
        pagos: [{ metodo: "tarjeta", importe: 9 }],
        partes: [{ lineaId: bravas!.id, cantidad: 1 }],
      }),
    ).toThrow("ya está pagada");

    // El resto paga lo que queda.
    t.hacer({ tipo: "cobrar", cuentaId: t.cuentaId, pagos: [{ metodo: "tarjeta", importe: 400 }] });
    expect(t.cuenta().estado).toBe("cobrada");
    expect(t.estado.tickets.slice(-2).map((x) => x.total)).toEqual([750, 400]);
    expect(verificarCadena(t.estado.tickets)).toBeNull();
  });
});

describe("propinas", () => {
  it("van aparte de la factura, entran en la caja y salen en el informe", () => {
    const t = preparar();
    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea("prod-5-1")] });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    expect(() =>
      t.hacer({
        tipo: "cobrar",
        cuentaId: t.cuentaId,
        pagos: [{ metodo: "tarjeta", importe: 650 }],
        propina: 100,
      }),
    ).toThrow("Faltan");
    const r = t.hacer({
      tipo: "cobrar",
      cuentaId: t.cuentaId,
      pagos: [{ metodo: "tarjeta", importe: 750 }],
      propina: 100,
    });
    const ticket = t.estado.tickets.at(-1)!;
    expect(ticket).toMatchObject({ total: 650, propina: 100 });
    expect(ticket.desglose.reduce((s, d) => s + d.total, 0)).toBe(650);
    expect(aTexto(r.trabajos[0]!.documento, 48)).toContain("Propina");
    const resumen = resumenTurno(t.estado, turnoAbierto(t.estado)!);
    expect(resumen).toMatchObject({ ventas: 650, propinas: 100 });
    expect(resumen.porMetodo.tarjeta).toBe(750);
    expect(informe(t.estado, rangoDeDias("2026-10-01", "2026-10-31")).propinas).toBe(100);
  });
});

describe("venta rápida", () => {
  it("cobra sin mesa y lo de cocina sigue en su pantalla hasta que sale", () => {
    const t = preparar();
    const r = t.hacer({
      tipo: "venta_rapida",
      lineas: [linea("prod-4-1", 2), linea("prod-7-1")],
      pagos: [{ metodo: "efectivo", importe: 1000 }],
    });
    const ticket = t.estado.tickets.at(-1)!;
    expect(ticket).toMatchObject({ mesaNombre: "Venta rápida", total: 280 + 650, cambio: 70 });
    expect(r.trabajos.map((j) => j.tipo)).toEqual(["comanda", "comanda", "ticket"]);
    const venta = t.estado.cuentas.at(-1)!;
    expect(venta.estado).toBe("cobrada");
    expect(cuentaEnJuego(venta, Date.parse(ctx.ahora))).toBe(true);
    const cocina = pedidosCocina(t.estado, "cocina");
    expect(cocina.map((p) => p.nombre)).toEqual(["Venta rápida"]);
    t.hacer({
      tipo: "marcar_lista",
      cuentaId: venta.id,
      lineaIds: cocina[0]!.lineas.map((l) => l.id),
    });
    t.hacer({
      tipo: "marcar_servida",
      cuentaId: venta.id,
      lineaIds: venta.lineas.map((l) => l.id),
    });
    expect(pedidosCocina(t.estado, "cocina")).toHaveLength(0);
  });
});

describe("para después y marcha", () => {
  it("lo de después espera en cocina hasta la marcha", () => {
    const t = preparar();
    t.hacer({
      tipo: "anotar",
      cuentaId: t.cuentaId,
      lineas: [linea("prod-5-2"), linea("prod-6-3", 1, { despues: true })],
    });
    const r = t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    const papel = aTexto(r.trabajos[0]!.documento, 48);
    expect(papel).toContain("PARA DESPUÉS");
    expect(papel.indexOf("Patatas bravas")).toBeLessThan(papel.indexOf("PARA DESPUÉS"));
    expect(t.cuenta().lineas.map((l) => l.estado)).toEqual(["enviada", "en_espera"]);
    const [pedido] = pedidosCocina(t.estado, "cocina");
    expect(pedido!.lineas.map((l) => l.estado)).toEqual(["enviada", "en_espera"]);

    const marcha = t.hacer({ tipo: "marchar", cuentaId: t.cuentaId });
    expect(t.cuenta().lineas.map((l) => l.estado)).toEqual(["enviada", "enviada"]);
    expect(marcha.trabajos[0]!.titulo).toMatch(/^Marcha · Cocina/);
    expect(aTexto(marcha.trabajos[0]!.documento, 48)).toContain("¡MARCHA!");
    expect(() => t.hacer({ tipo: "marchar", cuentaId: t.cuentaId })).toThrow("esperando");
  });

  it("se puede cambiar antes de mandar, no después", () => {
    const t = preparar();
    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea("prod-5-2")] });
    const l = t.cuenta().lineas[0]!;
    t.hacer({ tipo: "cambiar_despues", cuentaId: t.cuentaId, lineaId: l.id, despues: true });
    expect(t.cuenta().lineas[0]!.despues).toBe(true);
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    expect(() =>
      t.hacer({ tipo: "cambiar_despues", cuentaId: t.cuentaId, lineaId: l.id, despues: false }),
    ).toThrow("anularla");
  });
});

describe("menú del día", () => {
  it("la bebida del menú va a barra y el resto a cocina", () => {
    const t = preparar();
    const menu = {
      id: "menu",
      categoriaId: "cat-5",
      nombre: "Menú del día",
      descripcion: "",
      precio: 1400,
      iva: 10,
      alergenos: [],
      disponible: true,
      orden: 99,
      grupos: [
        {
          id: "g1",
          nombre: "Primero",
          obligatorio: true,
          multiple: false,
          opciones: [{ id: "o1", nombre: "Lentejas", suplemento: 0 }],
        },
        {
          id: "g2",
          nombre: "Bebida",
          obligatorio: true,
          multiple: false,
          opciones: [{ id: "o2", nombre: "Caña", suplemento: 0, destino: "barra" as const }],
        },
      ],
    };
    t.estado = { ...t.estado, productos: [...t.estado.productos, menu] };
    t.hacer({
      tipo: "anotar",
      cuentaId: t.cuentaId,
      lineas: [linea("menu", 1, { opciones: ["o1", "o2"] })],
    });
    const r = t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    expect(r.trabajos.map((j) => j.titulo)).toEqual([
      "Cocina · Mesa 1 · ronda 1",
      "Barra · Mesa 1 · ronda 1",
    ]);
    const cocina = aTexto(r.trabajos[0]!.documento, 48);
    const barra = aTexto(r.trabajos[1]!.documento, 48);
    expect(cocina).toContain("Lentejas");
    expect(cocina).not.toContain("Caña");
    expect(barra).toContain("Caña");
    expect(barra).not.toContain("Lentejas");
    // En la pantalla de barra sale la bebida, pero el plato es de cocina.
    const [enBarra] = pedidosCocina(t.estado, "barra");
    expect(enBarra).toBeUndefined();
    expect(pedidosCocina(t.estado, "cocina")).toHaveLength(1);
  });
});

describe("horarios", () => {
  const desayunos = { desde: "08:00", hasta: "12:00", dias: [1, 2, 3, 4, 5] };
  it("abre y cierra en hora de Madrid", () => {
    // Lunes 26/10/2026: horario de invierno, Madrid = UTC+1.
    expect(dentroDeHorario(desayunos, "2026-10-26T07:30:00Z")).toBe(true);
    expect(dentroDeHorario(desayunos, "2026-10-26T11:30:00Z")).toBe(false);
    expect(dentroDeHorario(desayunos, "2026-10-25T08:30:00Z")).toBe(false);
    const noche = { desde: "20:00", hasta: "02:00", dias: [5] };
    expect(dentroDeHorario(noche, "2026-10-30T23:30:00Z")).toBe(true);
    expect(dentroDeHorario(noche, "2026-10-31T00:30:00Z")).toBe(true);
    expect(dentroDeHorario(noche, "2026-10-29T23:30:00Z")).toBe(false);
    expect(describirHorario(desayunos)).toBe("De 08:00 a 12:00, de lunes a viernes");
  });

  it("la carta QR esconde y no deja pedir lo que está fuera de horario", () => {
    const t = preparar();
    t.estado = {
      ...t.estado,
      categorias: t.estado.categorias.map((c) =>
        c.nombre === "Cafés" ? { ...c, horario: desayunos } : c,
      ),
    };
    const fuera = "2026-10-26T15:00:00Z";
    const vista = vistaCliente(t.estado, t.mesa.token, fuera)!;
    expect(vista.categorias.map((c) => c.nombre)).not.toContain("Cafés");
    expect(
      vistaCliente(t.estado, t.mesa.token, "2026-10-26T08:00:00Z")!.categorias.map((c) => c.nombre),
    ).toContain("Cafés");
    expect(() =>
      reducirCliente(
        t.estado,
        t.mesa.token,
        { tipo: "pedir", lineas: [linea("prod-4-1")] },
        { ...ctx, ahora: fuera },
      ),
    ).toThrow("no se sirve a esta hora");
  });
});

describe("anotar", () => {
  it("junta lo mismo sin mandar en una sola línea", () => {
    const t = preparar();
    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea("prod-1-1")] });
    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea("prod-1-1")] });
    t.hacer({
      tipo: "anotar",
      cuentaId: t.cuentaId,
      lineas: [linea("prod-1-1", 1, { nota: "Sin espuma" })],
    });
    expect(t.cuenta().lineas.map((l) => [l.cantidad, l.nota])).toEqual([
      [2, ""],
      [1, "Sin espuma"],
    ]);
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea("prod-1-1")] });
    expect(t.cuenta().lineas).toHaveLength(3);
  });
});
