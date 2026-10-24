import { describe, expect, it } from "vitest";
import {
  calcularCambio,
  desgloseIva,
  dividirEnPartes,
  euros,
  leerEuros,
  lineasDeTicket,
  totalCuenta,
} from "@/lib/dominio/importes";
import type { LineaCuenta } from "@/lib/dominio/tipos";

function linea(datos: Partial<LineaCuenta>): LineaCuenta {
  return {
    id: "l",
    productoId: "p",
    nombre: "Caña",
    precioUnitario: 200,
    iva: 10,
    destino: "barra",
    cantidad: 1,
    opciones: [],
    nota: "",
    estado: "enviada",
    origen: "camarero",
    empleadoId: null,
    creadaEn: "",
    enviadaEn: null,
    listaEn: null,
    ronda: 1,
    invitacion: false,
    ...datos,
  };
}

describe("importes", () => {
  it("formatea y lee euros", () => {
    expect(euros(1234).replace(/\s/g, " ")).toBe("12,34 €");
    expect(leerEuros("12,5")).toBe(1250);
    expect(leerEuros("3")).toBe(300);
    expect(leerEuros("abc")).toBeNull();
    expect(leerEuros("1,234")).toBeNull();
  });

  it("no cobra anuladas, invitaciones ni pedidos sin aceptar, y suma los extras", () => {
    const cuenta = {
      descuento: 0,
      lineas: [
        linea({ cantidad: 2 }),
        linea({ estado: "anulada" }),
        linea({ estado: "por_confirmar" }),
        linea({ invitacion: true }),
        linea({
          precioUnitario: 1150,
          opciones: [{ grupo: "Extras", nombre: "Bacon", suplemento: 150 }],
        }),
      ],
    };
    expect(totalCuenta(cuenta)).toBe(400 + 1300);
    expect(totalCuenta({ ...cuenta, descuento: 10 })).toBe(1530);
  });

  it("agrupa líneas iguales en el ticket", () => {
    const lineas = lineasDeTicket({
      lineas: [linea({}), linea({ cantidad: 2 }), linea({ nombre: "Doble", precioUnitario: 300 })],
    });
    expect(lineas).toEqual([
      { nombre: "Caña", producto: "Caña", cantidad: 3, precioUnitario: 200, importe: 600, iva: 10 },
      {
        nombre: "Doble",
        producto: "Doble",
        cantidad: 1,
        precioUnitario: 300,
        importe: 300,
        iva: 10,
      },
    ]);
  });

  it("desglosa el IVA incluido y cuadra al céntimo con el total", () => {
    const d = desgloseIva(
      [
        { nombre: "a", producto: "a", cantidad: 1, precioUnitario: 1100, importe: 1100, iva: 10 },
        { nombre: "b", producto: "b", cantidad: 1, precioUnitario: 1210, importe: 1210, iva: 21 },
      ],
      15,
    );
    expect(d.map((x) => x.tipo)).toEqual([10, 21]);
    expect(d.reduce((s, x) => s + x.total, 0)).toBe(Math.round(2310 * 0.85));
    for (const x of d) expect(x.base + x.cuota).toBe(x.total);
    expect(d[0]).toMatchObject({ total: 935, base: 850, cuota: 85 });
  });

  it("solo devuelve cambio del efectivo", () => {
    expect(calcularCambio(1530, [{ metodo: "efectivo", importe: 2000 }])).toBe(470);
    expect(calcularCambio(1530, [{ metodo: "tarjeta", importe: 2000 }])).toBe(0);
    expect(
      calcularCambio(1500, [
        { metodo: "tarjeta", importe: 1000 },
        { metodo: "efectivo", importe: 1000 },
      ]),
    ).toBe(500);
  });

  it("divide sin perder céntimos", () => {
    expect(dividirEnPartes(1000, 3)).toEqual([334, 333, 333]);
    expect(dividirEnPartes(1000, 3).reduce((a, b) => a + b)).toBe(1000);
  });
});
