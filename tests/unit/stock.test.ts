import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { informe, rangoDeDias } from "@/lib/dominio/informes";
import { migrar } from "@/lib/dominio/migraciones";
import { estadoNuevo } from "@/lib/dominio/nuevo";
import { cuentaDeMesa, reducirCliente, reducirPersonal } from "@/lib/dominio/reducir";
import {
  cantidadAPedir,
  costeReceta,
  formatearCantidad,
  leerCantidad,
  listaDeLaCompra,
  pedidoDeFactura,
  textoPedido,
} from "@/lib/dominio/stock";
import type { Estado } from "@/lib/dominio/tipos";
import { contexto } from "./ayuda";

const ctx = contexto();

function preparar() {
  let estado: Estado = estadoDeEjemplo(ctx);
  const ana = estado.empleados[0]!;
  const luis = estado.empleados[1]!;
  const hacer = (accion: AccionPersonal, quien = ana) => {
    estado = reducirPersonal(estado, accion, quien, ctx).estado;
  };
  hacer({ tipo: "abrir_caja", fondoInicial: 0 });
  const mesa = estado.mesas.find((m) => m.nombre === "Mesa 1")!;
  hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2 });
  const cuentaId = cuentaDeMesa(estado, mesa.id)!.id;
  return {
    get estado() {
      return estado;
    },
    hacer,
    ana,
    luis,
    mesa,
    cuentaId,
    ing: (id: string) => estado.ingredientes.find((i) => i.id === id)!,
    producto: (nombre: string) => estado.productos.find((p) => p.nombre === nombre)!,
  };
}

const linea = (productoId: string, cantidad = 1) => ({
  productoId,
  cantidad,
  opciones: [],
  nota: "",
});

describe("escandallos", () => {
  it("descuenta al mandar a cocina, no al anotar", () => {
    const t = preparar();
    const cerveza = t.ing("ing-cerveza").existencias;
    const caña = t.producto("Caña");
    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea(caña.id, 3)] });
    expect(t.ing("ing-cerveza").existencias).toBe(cerveza);
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    expect(t.ing("ing-cerveza").existencias).toBeCloseTo(cerveza - 0.6);
  });

  it("devuelve lo de una línea anulada y de una cuenta anulada", () => {
    const t = preparar();
    const patata = t.ing("ing-patata").existencias;
    const bravas = t.producto("Patatas bravas");
    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea(bravas.id, 2)] });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    expect(t.ing("ing-patata").existencias).toBeCloseTo(patata - 0.6);
    const l = t.estado.cuentas.find((c) => c.id === t.cuentaId)!.lineas[0]!;
    t.hacer({ tipo: "anular_linea", cuentaId: t.cuentaId, lineaId: l.id, motivo: "Se equivocó" });
    expect(t.ing("ing-patata").existencias).toBeCloseTo(patata);

    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea(bravas.id)] });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    t.hacer({ tipo: "anular_cuenta", cuentaId: t.cuentaId });
    // La línea anulada antes no se devuelve dos veces.
    expect(t.ing("ing-patata").existencias).toBeCloseTo(patata);
  });

  it("descuenta también lo que llega del QR sin confirmar", () => {
    const t = preparar();
    t.hacer({
      tipo: "guardar_ajustes",
      ajustes: { ...t.estado.ajustes, confirmarPedidosQR: false },
    });
    const croquetas = t.ing("ing-croqueta").existencias;
    const r = reducirCliente(
      t.estado,
      t.mesa.token,
      { tipo: "pedir", lineas: [linea(t.producto("Croquetas de jamón (4 uds.)").id, 2)] },
      ctx,
    );
    expect(r.estado.ingredientes.find((i) => i.id === "ing-croqueta")!.existencias).toBe(
      croquetas - 8,
    );
  });

  it("agota el plato cuando no llega para otra ración y lo repone al recibir género", () => {
    const t = preparar();
    const pulpo = t.producto("Pulpo a la gallega");
    t.hacer({
      tipo: "ajustar_stock",
      ingredienteId: "ing-pulpo",
      ajuste: "recuento",
      cantidad: 0.3,
      nota: "",
    });
    expect(t.producto("Pulpo a la gallega").disponible).toBe(true);
    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea(pulpo.id)] });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    expect(t.producto("Pulpo a la gallega")).toMatchObject({
      disponible: false,
      agotadoPorStock: true,
    });
    expect(() =>
      t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea(pulpo.id)] }),
    ).toThrow(/agotado/);

    t.hacer({
      tipo: "recibir_compra",
      proveedor: "Lonja Inventada",
      lineas: [{ ingredienteId: "ing-pulpo", cantidad: 3, importe: 7500 }],
      apuntarGasto: true,
      iva: 10,
      metodo: "tarjeta",
      deCaja: false,
    });
    expect(t.producto("Pulpo a la gallega").disponible).toBe(true);
    expect(t.producto("Pulpo a la gallega").agotadoPorStock).toBeUndefined();
    expect(t.ing("ing-pulpo")).toMatchObject({ existencias: 3.05, coste: 2500 });
    const gasto = t.estado.gastos.at(-1)!;
    expect(gasto).toMatchObject({
      categoria: "proveedores",
      proveedor: "Lonja Inventada",
      importe: 7500,
      concepto: "Pedido: Pulpo cocido",
    });
    expect(t.estado.movimientosStock.at(-1)).toMatchObject({
      tipo: "compra",
      cantidad: 3,
      gastoId: gasto.id,
    });
  });

  it("lo que se agota a mano no lo repone el stock", () => {
    const t = preparar();
    const caña = t.producto("Caña");
    t.hacer({ tipo: "cambiar_disponible", productoId: caña.id, disponible: false }, t.luis);
    t.hacer({
      tipo: "recibir_compra",
      proveedor: "",
      lineas: [{ ingredienteId: "ing-cerveza", cantidad: 30, importe: 0 }],
      apuntarGasto: false,
      iva: 21,
      metodo: "tarjeta",
      deCaja: false,
    });
    expect(t.producto("Caña").disponible).toBe(false);
    // Sin importe no cambia el precio ni se apunta gasto.
    expect(t.ing("ing-cerveza").coste).toBe(160);
    expect(t.estado.gastos).toHaveLength(0);
  });

  it("recuento y merma, que puede hacer cualquiera del equipo", () => {
    const t = preparar();
    t.hacer(
      {
        tipo: "ajustar_stock",
        ingredienteId: "ing-huevo",
        ajuste: "recuento",
        cantidad: 40,
        nota: "",
      },
      t.luis,
    );
    t.hacer(
      {
        tipo: "ajustar_stock",
        ingredienteId: "ing-huevo",
        ajuste: "merma",
        cantidad: 6,
        nota: "Se cayó una caja",
      },
      t.luis,
    );
    expect(t.ing("ing-huevo").existencias).toBe(34);
    expect(t.estado.movimientosStock.map((m) => [m.tipo, m.cantidad])).toEqual([
      ["recuento", -14],
      ["merma", -6],
    ]);
  });

  it("pagar con la caja una compra la saca del arqueo", () => {
    const t = preparar();
    t.hacer({
      tipo: "recibir_compra",
      proveedor: "Panadería Ejemplo",
      lineas: [{ ingredienteId: "ing-pan", cantidad: 20, importe: 1400 }],
      apuntarGasto: true,
      iva: 4,
      metodo: "efectivo",
      deCaja: true,
    });
    const turno = t.estado.turnos.at(-1)!;
    expect(turno.movimientos.at(-1)).toMatchObject({ tipo: "salida", importe: 1400 });
  });

  it("solo el encargado recibe compras y edita ingredientes", () => {
    const t = preparar();
    expect(() => t.hacer({ tipo: "borrar_ingrediente", ingredienteId: "ing-pan" }, t.luis)).toThrow(
      /encargado/,
    );
  });

  it("borrar un ingrediente lo quita de los escandallos", () => {
    const t = preparar();
    t.hacer({ tipo: "borrar_ingrediente", ingredienteId: "ing-cerveza" });
    expect(t.producto("Caña").receta).toBeUndefined();
    expect(t.producto("Bocadillo vegetal").receta).toHaveLength(2);
  });

  it("guardar un plato con escandallo comprueba los ingredientes", () => {
    const t = preparar();
    const { id: _id, agotadoPorStock: _a, ...caña } = t.producto("Caña");
    void _a;
    expect(() =>
      t.hacer({
        tipo: "guardar_producto",
        producto: { ...caña, id: _id, receta: [{ ingredienteId: "no-existe", cantidad: 1 }] },
      }),
    ).toThrow(/ingrediente/);
    t.hacer({ tipo: "guardar_producto", producto: { ...caña, id: _id, receta: [] } });
    expect(t.producto("Caña").receta).toBeUndefined();
  });

  it("no deja dos ingredientes con el mismo nombre", () => {
    const t = preparar();
    expect(() =>
      t.hacer({
        tipo: "guardar_ingrediente",
        ingrediente: {
          nombre: "patatas",
          unidad: "kg",
          minimo: 1,
          coste: 100,
          proveedor: "",
        },
      }),
    ).toThrow(/Ya hay/);
  });
});

describe("costes y lista de la compra", () => {
  it("el coste de la ración sale del escandallo", () => {
    const t = preparar();
    const huevos = t.producto("Huevos rotos con jamón");
    // 2 huevos × 0,25 + 0,25 kg × 1,10 + 0,05 kg × 22 + 0,05 l × 9 = 0,50 + 0,275 + 1,10 + 0,45
    expect(costeReceta(huevos.receta!, t.estado.ingredientes)).toBe(233);
  });

  it("el informe usa el coste del escandallo para el margen", () => {
    const t = preparar();
    const caña = t.producto("Caña");
    t.hacer({ tipo: "anotar", cuentaId: t.cuentaId, lineas: [linea(caña.id, 10)] });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuentaId });
    t.hacer({
      tipo: "cobrar",
      cuentaId: t.cuentaId,
      pagos: [{ metodo: "tarjeta", importe: 2000 }],
    });
    const r = informe(t.estado, rangoDeDias(ctx.ahora.slice(0, 10), ctx.ahora.slice(0, 10)));
    // 10 cañas × 0,2 l × 1,60 €/l
    expect(r.productos.find((p) => p.nombre === "Caña")!.coste).toBe(320);
  });

  it("pide lo que está en el mínimo, agrupado por proveedor", () => {
    const t = preparar();
    const lista = listaDeLaCompra(t.estado.ingredientes);
    expect(lista.map((p) => p.proveedor)).toEqual(["Lonja Inventada"]);
    expect(lista[0]!.lineas[0]).toMatchObject({ cantidad: 3.1, importe: 8060 });
    expect(textoPedido(lista[0]!, "La Esquina")).toBe(
      "Hola, pedido de La Esquina:\n- Pulpo cocido: 3,1 kg\nGracias.",
    );
  });

  it("las unidades se piden enteras y sin «pedir hasta» se pide el doble del mínimo", () => {
    expect(
      cantidadAPedir({
        id: "x",
        nombre: "Limones",
        unidad: "ud",
        existencias: 2.5,
        minimo: 5,
        coste: 10,
        proveedor: "",
      }),
    ).toBe(8);
  });

  it("lee y escribe cantidades a la española", () => {
    expect(leerCantidad("1,5")).toBe(1.5);
    expect(leerCantidad("2.25")).toBe(2.25);
    expect(leerCantidad("abc")).toBeNull();
    expect(formatearCantidad(0.2, "l")).toBe("0,2 l");
  });
});

describe("datos guardados", () => {
  it("un estado de la versión 2 pasa a la 3 con el almacén vacío", () => {
    const { ingredientes: _i, movimientosStock: _m, ...v2 } = estadoDeEjemplo(ctx);
    void _i;
    void _m;
    const e = migrar({ ...v2, version: 2 } as Estado);
    expect(e).toMatchObject({ version: 3, ingredientes: [], movimientosStock: [] });
  });

  it("un bar nuevo con la carta de ejemplo empieza sin stock ni escandallos", () => {
    const e = estadoNuevo(ctx, {
      nombre: "Bar Prueba",
      encargado: "Eva",
      pin: "4321",
      conCartaDeEjemplo: true,
    });
    expect(e.ingredientes).toEqual([]);
    expect(e.productos.some((p) => p.receta)).toBe(false);
  });
});

describe("factura leída con foto", () => {
  it("se queda con lo que casa, suma repetidos y pasa los euros a céntimos", () => {
    const { ingredientes } = estadoDeEjemplo(ctx);
    const pedido = pedidoDeFactura(
      {
        proveedor: "  Lonja Inventada ",
        iva: 10,
        lineas: [
          {
            ingredienteId: "ing-pulpo",
            descripcion: "Pulpo cocido 2 kg",
            cantidad: 2,
            importe: 52,
          },
          {
            ingredienteId: "ing-pulpo",
            descripcion: "Pulpo cocido 1 kg",
            cantidad: 1,
            importe: 26.5,
          },
          { ingredienteId: "ing-calamar", descripcion: "Calamar", cantidad: 0, importe: 14 },
          { ingredienteId: "no-existe", descripcion: "Mejillón", cantidad: 3, importe: 9 },
          { ingredienteId: null, descripcion: "Portes", cantidad: 1, importe: 5 },
        ],
      },
      ingredientes,
    );
    expect(pedido).toEqual({
      proveedor: "Lonja Inventada",
      iva: 10,
      lineas: [{ ingredienteId: "ing-pulpo", cantidad: 3, importe: 7850 }],
      sinCasar: ["Calamar", "Mejillón", "Portes"],
    });
  });

  it("un IVA raro se cambia por el de hostelería y un importe imposible por 0", () => {
    const { ingredientes } = estadoDeEjemplo(ctx);
    const pedido = pedidoDeFactura(
      {
        proveedor: "",
        iva: 7,
        lineas: [{ ingredienteId: "ing-pan", descripcion: "Pan", cantidad: 20, importe: -3 }],
      },
      ingredientes,
    );
    expect(pedido.iva).toBe(10);
    expect(pedido.lineas[0]).toEqual({ ingredienteId: "ing-pan", cantidad: 20, importe: 0 });
  });
});
