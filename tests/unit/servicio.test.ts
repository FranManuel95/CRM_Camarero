import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { totalCuenta } from "@/lib/dominio/importes";
import { cuentaDeMesa, reducirPersonal } from "@/lib/dominio/reducir";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { aTexto } from "@/lib/impresion/documento";
import { vistaCliente } from "@/lib/servidor/vistas";
import { contexto } from "./ayuda";

const ctx = contexto();
const linea = (productoId: string, cantidad = 1) => ({
  productoId,
  cantidad,
  opciones: [],
  nota: "",
});
// Caña 2,00 € · Croquetas 6,50 € · Pulpo 16,50 €
const CAÑA = "prod-1-1";
const CROQUETAS = "prod-5-1";

function preparar() {
  let estado: Estado = estadoDeEjemplo(ctx);
  const [ana, luis] = estado.empleados as [Empleado, Empleado];
  const hacer = (accion: AccionPersonal, quien = luis) => {
    const r = reducirPersonal(estado, accion, quien, ctx);
    estado = r.estado;
    return r;
  };
  hacer({ tipo: "abrir_caja", fondoInicial: 0 }, ana);
  const mesa = estado.mesas.find((m) => m.nombre === "Mesa 5")!;
  hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2 });
  const cuenta = () => cuentaDeMesa(estado, mesa.id)!;
  return {
    get estado() {
      return estado;
    },
    hacer,
    ana,
    luis,
    mesa,
    cuenta,
    lineaDe: (productoId: string) => cuenta().lineas.find((l) => l.productoId === productoId)!,
  };
}

describe("mandar con o sin papel", () => {
  it("sin imprimir, la comanda llega a cocina pero no sale en papel", () => {
    const t = preparar();
    t.hacer({ tipo: "anotar", cuentaId: t.cuenta().id, lineas: [linea(CROQUETAS)] });
    const r = t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuenta().id, imprimir: false });
    expect(r.trabajos).toEqual([]);
    expect(t.lineaDe(CROQUETAS).estado).toBe("enviada");
    t.hacer({ tipo: "anotar", cuentaId: t.cuenta().id, lineas: [linea(CAÑA)] });
    expect(t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuenta().id }).trabajos).toHaveLength(1);
  });

  it("el bar puede decidir que por defecto no se imprima", () => {
    const t = preparar();
    t.hacer(
      {
        tipo: "guardar_ajustes",
        ajustes: { ...t.estado.ajustes, imprimirComandas: false },
      },
      t.ana,
    );
    t.hacer({ tipo: "anotar", cuentaId: t.cuenta().id, lineas: [linea(CROQUETAS)] });
    expect(t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuenta().id }).trabajos).toEqual([]);
    t.hacer({ tipo: "anotar", cuentaId: t.cuenta().id, lineas: [linea(CAÑA)] });
    expect(
      t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuenta().id, imprimir: true }).trabajos,
    ).toHaveLength(1);
  });
});

describe("precios y descuentos al cobrar", () => {
  function conCuenta() {
    const t = preparar();
    t.hacer({
      tipo: "anotar",
      cuentaId: t.cuenta().id,
      lineas: [linea(CAÑA, 2), linea(CROQUETAS)],
    });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuenta().id });
    return t;
  }

  it("cambia el precio y pone descuento a varias líneas a la vez, y vuelve al de la carta", () => {
    const t = conCuenta();
    expect(totalCuenta(t.cuenta())).toBe(1050);
    const ids = [t.lineaDe(CAÑA).id, t.lineaDe(CROQUETAS).id];
    t.hacer({
      tipo: "ajustar_lineas",
      cuentaId: t.cuenta().id,
      lineaIds: [t.lineaDe(CAÑA).id],
      cambio: { tipo: "precio", precio: 250 },
    });
    expect(totalCuenta(t.cuenta())).toBe(1150);
    t.hacer({
      tipo: "ajustar_lineas",
      cuentaId: t.cuenta().id,
      lineaIds: ids,
      cambio: { tipo: "descuento", porcentaje: 10 },
    });
    // (5,00 + 6,50) − 10 %
    expect(totalCuenta(t.cuenta())).toBe(1035);
    expect(t.estado.historial.at(-1)!.texto).toMatch(/10 % de descuento a 2 Caña, 1 Croquetas/);
    t.hacer({
      tipo: "ajustar_lineas",
      cuentaId: t.cuenta().id,
      lineaIds: ids,
      cambio: { tipo: "original" },
    });
    expect(totalCuenta(t.cuenta())).toBe(1050);
  });

  it("descuento en euros («cóbrale 10 €»), que sale en el ticket y cuadra el IVA", () => {
    const t = conCuenta();
    t.hacer({ tipo: "aplicar_descuento", cuentaId: t.cuenta().id, descuento: 0, importe: 50 });
    expect(totalCuenta(t.cuenta())).toBe(1000);
    expect(() =>
      t.hacer({ tipo: "aplicar_descuento", cuentaId: t.cuenta().id, descuento: 0, importe: 5000 }),
    ).toThrow(/no puede pasar/);
    const r = t.hacer({
      tipo: "cobrar",
      cuentaId: t.cuenta().id,
      pagos: [{ metodo: "efectivo", importe: 1000 }],
    });
    const ticket = t.estado.tickets.at(-1)!;
    expect(ticket.total).toBe(1000);
    expect(ticket.descuentoImporte).toBe(50);
    expect(ticket.desglose.reduce((s, d) => s + d.total, 0)).toBe(1000);
    const papel = aTexto(r.trabajos.find((j) => j.tipo === "ticket")!.documento, 48);
    expect(papel).toMatch(/Descuento\s+-0,50/);
  });

  it("por partes, el descuento en euros va en el pago que salda la cuenta", () => {
    const t = conCuenta();
    t.hacer({ tipo: "aplicar_descuento", cuentaId: t.cuenta().id, descuento: 0, importe: 50 });
    t.hacer({
      tipo: "cobrar",
      cuentaId: t.cuenta().id,
      pagos: [{ metodo: "tarjeta", importe: 650 }],
      partes: [{ lineaId: t.lineaDe(CROQUETAS).id, cantidad: 1 }],
    });
    expect(t.estado.tickets.at(-1)!.total).toBe(650);
    expect(totalCuenta(t.cuenta())).toBe(350);
    t.hacer({
      tipo: "cobrar",
      cuentaId: t.cuenta().id,
      pagos: [{ metodo: "tarjeta", importe: 350 }],
    });
    expect(t.estado.tickets.at(-1)!.total).toBe(350);
  });

  it("si el bar quiere, solo el encargado cambia precios", () => {
    const t = conCuenta();
    t.hacer(
      { tipo: "guardar_ajustes", ajustes: { ...t.estado.ajustes, preciosSoloEncargado: true } },
      t.ana,
    );
    const cambio = {
      tipo: "ajustar_lineas" as const,
      cuentaId: t.cuenta().id,
      lineaIds: [t.lineaDe(CAÑA).id],
      cambio: { tipo: "precio" as const, precio: 100 },
    };
    expect(() => t.hacer(cambio)).toThrow(/encargado/);
    t.hacer(cambio, t.ana);
    expect(t.lineaDe(CAÑA).precioCambiado).toBe(100);
  });
});

describe("productos ocultos y agotados", () => {
  it("oculto: ni el QR ni el camarero lo pueden pedir; el encargado sí", () => {
    const t = preparar();
    expect(() =>
      t.hacer({
        tipo: "cambiar_disponible",
        productoId: CROQUETAS,
        disponible: true,
        oculto: true,
      }),
    ).toThrow(/encargado/);
    t.hacer(
      { tipo: "cambiar_disponible", productoId: CROQUETAS, disponible: true, oculto: true },
      t.ana,
    );
    const token = t.estado.mesas[0]!.token;
    expect(vistaCliente(t.estado, token)!.productos.some((p) => p.id === CROQUETAS)).toBe(false);
    expect(() =>
      t.hacer({ tipo: "anotar", cuentaId: t.cuenta().id, lineas: [linea(CROQUETAS)] }),
    ).toThrow(/no está en la carta/);
    t.hacer({ tipo: "anotar", cuentaId: t.cuenta().id, lineas: [linea(CROQUETAS)] }, t.ana);
    expect(t.lineaDe(CROQUETAS)).toBeDefined();
    expect(t.estado.historial.at(-1)!.texto).toBe("Ocultó Croquetas de jamón (4 uds.) de la carta");
  });
});
