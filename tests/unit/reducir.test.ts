import { describe, expect, it } from "vitest";
import { resumenTurno, turnoAbierto } from "@/lib/dominio/caja";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { verificarCadena } from "@/lib/dominio/huella";
import { totalCuenta } from "@/lib/dominio/importes";
import { cuentaDeMesa, ErrorAccion, reducirCliente, reducirPersonal } from "@/lib/dominio/reducir";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import type { Estado } from "@/lib/dominio/tipos";
import { aTexto } from "@/lib/impresion/documento";
import { contexto } from "./ayuda";

const ctx = contexto();

function preparar() {
  let estado = estadoDeEjemplo(ctx);
  const ana = estado.empleados.find((e) => e.rol === "encargado")!;
  const luis = estado.empleados.find((e) => e.nombre === "Luis")!;
  const hacer = (accion: AccionPersonal, quien = luis) => {
    const r = reducirPersonal(estado, accion, quien, ctx);
    estado = r.estado;
    return r;
  };
  const mesa = estado.mesas.find((m) => m.nombre === "Mesa 1")!;
  return {
    get estado(): Estado {
      return estado;
    },
    set estado(e: Estado) {
      estado = e;
    },
    ana,
    luis,
    hacer,
    mesa,
  };
}

describe("servicio de una mesa", () => {
  it("abre, anota, manda a cocina y barra por separado, y cobra con cambio", () => {
    const t = preparar();
    t.hacer({ tipo: "abrir_caja", fondoInicial: 10000 }, t.ana);
    t.hacer({ tipo: "abrir_cuenta", mesaId: t.mesa.id, comensales: 2 });
    const cuenta = cuentaDeMesa(t.estado, t.mesa.id)!;
    t.hacer({
      tipo: "anotar",
      cuentaId: cuenta.id,
      lineas: [
        { productoId: "prod-1-1", cantidad: 2, opciones: [], nota: "" },
        { productoId: "prod-5-1", cantidad: 1, opciones: [], nota: "Sin prisa" },
      ],
    });
    const envio = t.hacer({ tipo: "enviar_comanda", cuentaId: cuenta.id });
    expect(envio.trabajos.map((j) => j.titulo)).toEqual([
      "Cocina · Mesa 1 · ronda 1",
      "Barra · Mesa 1 · ronda 1",
    ]);
    expect(aTexto(envio.trabajos[0]!.documento, 32)).toContain("¡Sin prisa!");

    const abierta = cuentaDeMesa(t.estado, t.mesa.id)!;
    expect(totalCuenta(abierta)).toBe(1050);
    expect(() =>
      t.hacer({
        tipo: "cobrar",
        cuentaId: cuenta.id,
        pagos: [{ metodo: "tarjeta", importe: 2000 }],
      }),
    ).toThrow("no se puede cobrar de más");
    const cobro = t.hacer({
      tipo: "cobrar",
      cuentaId: cuenta.id,
      pagos: [{ metodo: "efectivo", importe: 2000 }],
    });
    const ticket = t.estado.tickets.at(-1)!;
    expect(ticket).toMatchObject({ numero: "T2026-000001", total: 1050, cambio: 950 });
    expect(ticket.huella).toMatch(/^[0-9A-F]{64}$/);
    expect(cuentaDeMesa(t.estado, t.mesa.id)).toBeUndefined();
    expect(cobro.trabajos[0]?.tipo).toBe("ticket");
    expect(aTexto(cobro.trabajos[0]!.documento, 48)).toContain("FACTURA SIMPLIFICADA");

    const resumen = resumenTurno(t.estado, turnoAbierto(t.estado)!);
    expect(resumen.porMetodo.efectivo).toBe(1050);
    expect(resumen.efectivoEsperado).toBe(11050);
  });

  it("no deja cobrar con la caja cerrada", () => {
    const t = preparar();
    t.hacer({ tipo: "abrir_cuenta", mesaId: t.mesa.id, comensales: 1 });
    const cuenta = cuentaDeMesa(t.estado, t.mesa.id)!;
    expect(() =>
      t.hacer({ tipo: "cobrar", cuentaId: cuenta.id, pagos: [{ metodo: "tarjeta", importe: 0 }] }),
    ).toThrow(ErrorAccion);
  });

  it("encadena las huellas y numera seguido; la rectificativa resta", () => {
    const t = preparar();
    t.hacer({ tipo: "abrir_caja", fondoInicial: 0 }, t.ana);
    for (const nombre of ["Mesa 1", "Mesa 2"]) {
      const mesa = t.estado.mesas.find((m) => m.nombre === nombre)!;
      t.hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 1 });
      const c = cuentaDeMesa(t.estado, mesa.id)!;
      t.hacer({
        tipo: "anotar",
        cuentaId: c.id,
        lineas: [{ productoId: "prod-4-1", cantidad: 1, opciones: [], nota: "" }],
      });
      t.hacer({ tipo: "enviar_comanda", cuentaId: c.id });
      t.hacer({ tipo: "cobrar", cuentaId: c.id, pagos: [{ metodo: "tarjeta", importe: 140 }] });
    }
    const primero = t.estado.tickets[0]!;
    expect(() => t.hacer({ tipo: "rectificar_ticket", ticketId: primero.id })).toThrow("encargado");
    t.hacer({ tipo: "rectificar_ticket", ticketId: primero.id }, t.ana);
    expect(t.estado.tickets.map((x) => x.numero)).toEqual([
      "T2026-000001",
      "T2026-000002",
      "T2026-000003",
    ]);
    expect(t.estado.tickets[2]).toMatchObject({ total: -140, rectificaA: primero.id });
    expect(verificarCadena(t.estado.tickets)).toBeNull();
    const roto = t.estado.tickets.map((x, i) => (i === 1 ? { ...x, huella: "MANIPULADO" } : x));
    expect(verificarCadena(roto)).toBe("T2026-000003");
    expect(resumenTurno(t.estado, turnoAbierto(t.estado)!).ventas).toBe(140);
  });

  it("valida las opciones obligatorias y de una sola elección", () => {
    const t = preparar();
    t.hacer({ tipo: "abrir_cuenta", mesaId: t.mesa.id, comensales: 1 });
    const c = cuentaDeMesa(t.estado, t.mesa.id)!;
    const burger = t.estado.productos.find((p) => p.nombre === "Hamburguesa La Esquina")!;
    const anotar = (opciones: string[]) =>
      t.hacer({
        tipo: "anotar",
        cuentaId: c.id,
        lineas: [{ productoId: burger.id, cantidad: 1, opciones, nota: "" }],
      });
    expect(() => anotar([])).toThrow("Elige punto");
    expect(() => anotar(["o-hpoco", "o-hhecha"])).toThrow("solo vale una");
    anotar(["o-hpunto", "o-bacon", "o-huevo"]);
    expect(totalCuenta(cuentaDeMesa(t.estado, t.mesa.id)!)).toBe(1150 + 150 + 120);
  });

  it("junta dos mesas al mover una cuenta a una mesa ocupada", () => {
    const t = preparar();
    const otra = t.estado.mesas.find((m) => m.nombre === "Mesa 2")!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: t.mesa.id, comensales: 2 });
    t.hacer({ tipo: "abrir_cuenta", mesaId: otra.id, comensales: 3 });
    const c1 = cuentaDeMesa(t.estado, t.mesa.id)!;
    t.hacer({
      tipo: "anotar",
      cuentaId: c1.id,
      lineas: [{ productoId: "prod-1-1", cantidad: 1, opciones: [], nota: "" }],
    });
    t.hacer({ tipo: "mover_cuenta", cuentaId: c1.id, mesaId: otra.id });
    expect(cuentaDeMesa(t.estado, t.mesa.id)).toBeUndefined();
    expect(cuentaDeMesa(t.estado, otra.id)).toMatchObject({ comensales: 5 });
    expect(cuentaDeMesa(t.estado, otra.id)!.lineas).toHaveLength(1);
  });

  it("solo el encargado cambia la carta y siempre queda uno", () => {
    const t = preparar();
    const producto = t.estado.productos[0]!;
    expect(() =>
      t.hacer({ tipo: "guardar_producto", producto: { ...producto, precio: 1 } }),
    ).toThrow("encargado");
    t.hacer({ tipo: "guardar_producto", producto: { ...producto, precio: 250 } }, t.ana);
    expect(t.estado.productos[0]!.precio).toBe(250);
    expect(() =>
      t.hacer({ tipo: "guardar_empleado", empleado: { ...t.ana, rol: "camarero" } }, t.ana),
    ).toThrow("al menos un encargado");
  });

  it("al pagar un gasto con dinero de la caja, sale en el arqueo", () => {
    const t = preparar();
    t.hacer({ tipo: "abrir_caja", fondoInicial: 5000 }, t.ana);
    t.hacer(
      {
        tipo: "guardar_gasto",
        gasto: {
          fecha: ctx.ahora,
          concepto: "Hielo",
          categoria: "proveedores",
          proveedor: "",
          importe: 800,
          iva: 10,
          metodo: "efectivo",
          deCaja: true,
        },
      },
      t.ana,
    );
    expect(resumenTurno(t.estado, turnoAbierto(t.estado)!).efectivoEsperado).toBe(4200);
  });
});

describe("pedidos desde el QR", () => {
  it("abre la cuenta sola y espera a que el camarero acepte", () => {
    const t = preparar();
    const r = reducirCliente(
      t.estado,
      t.mesa.token,
      { tipo: "pedir", lineas: [{ productoId: "prod-1-1", cantidad: 2, opciones: [], nota: "" }] },
      ctx,
    );
    t.estado = r.estado;
    expect(r.trabajos).toHaveLength(0);
    const cuenta = cuentaDeMesa(t.estado, t.mesa.id)!;
    expect(cuenta.lineas[0]).toMatchObject({ estado: "por_confirmar", origen: "qr" });
    expect(t.estado.avisos.filter((a) => !a.atendido).map((a) => a.tipo)).toEqual(["pedido_qr"]);
    expect(totalCuenta(cuenta)).toBe(0);

    const aceptado = t.hacer({ tipo: "aceptar_pedido_qr", cuentaId: cuenta.id });
    expect(aceptado.trabajos).toHaveLength(1);
    expect(cuentaDeMesa(t.estado, t.mesa.id)!.lineas[0]).toMatchObject({
      estado: "enviada",
      empleadoId: t.luis.id,
    });
    expect(t.estado.avisos.some((a) => !a.atendido)).toBe(false);
  });

  it("si no hay que confirmar, va directo a cocina", () => {
    const t = preparar();
    t.estado = { ...t.estado, ajustes: { ...t.estado.ajustes, confirmarPedidosQR: false } };
    const r = reducirCliente(
      t.estado,
      t.mesa.token,
      { tipo: "pedir", lineas: [{ productoId: "prod-5-2", cantidad: 1, opciones: [], nota: "" }] },
      ctx,
    );
    expect(r.trabajos.map((j) => j.titulo)).toEqual(["Cocina · Mesa 1 · ronda 1"]);
  });

  it("rechaza QR viejos, productos agotados y pedir la cuenta sin consumir", () => {
    const t = preparar();
    expect(() => reducirCliente(t.estado, "no-existe", { tipo: "llamar_camarero" }, ctx)).toThrow(
      "QR ya no es válido",
    );
    t.hacer({ tipo: "cambiar_disponible", productoId: "prod-1-1", disponible: false });
    expect(() =>
      reducirCliente(
        t.estado,
        t.mesa.token,
        {
          tipo: "pedir",
          lineas: [{ productoId: "prod-1-1", cantidad: 1, opciones: [], nota: "" }],
        },
        ctx,
      ),
    ).toThrow("agotado");
    expect(() =>
      reducirCliente(t.estado, t.mesa.token, { tipo: "pedir_cuenta", metodo: "tarjeta" }, ctx),
    ).toThrow("nada que cobrar");
  });

  it("no duplica el aviso de llamar al camarero", () => {
    const t = preparar();
    t.estado = reducirCliente(t.estado, t.mesa.token, { tipo: "llamar_camarero" }, ctx).estado;
    t.estado = reducirCliente(t.estado, t.mesa.token, { tipo: "llamar_camarero" }, ctx).estado;
    expect(t.estado.avisos).toHaveLength(1);
  });
});

describe("datos de ejemplo", () => {
  it("generan dos semanas de ventas con la caja de hoy abierta", () => {
    const estado = estadoDeEjemplo(contexto(), { conHistorial: true });
    expect(estado.tickets.length).toBeGreaterThan(150);
    expect(verificarCadena(estado.tickets)).toBeNull();
    expect(turnoAbierto(estado)).toBeDefined();
    expect(estado.cuentas.filter((c) => c.estado === "abierta")).toHaveLength(2);
    expect(estado.gastos).toHaveLength(10);
  });
});

describe("PIN y versiones", () => {
  it("guarda los PIN resumidos y pone al día los datos antiguos", async () => {
    const { migrar } = await import("@/lib/dominio/migraciones");
    const { resumenPin } = await import("@/lib/dominio/pin");
    const estado = estadoDeEjemplo(contexto());
    expect(estado.empleados[0]!.pin).toBe(resumenPin("1234"));
    const antiguo = {
      ...estado,
      version: 1,
      empleados: [{ ...estado.empleados[0]!, pin: "1234" }],
    };
    expect(migrar(antiguo).empleados[0]!.pin).toBe(resumenPin("1234"));
    expect(() => migrar({ ...estado, version: 99 })).toThrow("versión desconocida");
  });
});

describe("bares nuevos y vinculación", () => {
  it("crea un bar con su encargado y la carta que se pida", async () => {
    const { estadoNuevo } = await import("@/lib/dominio/nuevo");
    const { primerosPasos } = await import("@/lib/dominio/primeros-pasos");
    const { resumenPin } = await import("@/lib/dominio/pin");
    const vacio = estadoNuevo(contexto(), {
      nombre: "Bar Paco",
      encargado: "Paco",
      pin: "4321",
      conCartaDeEjemplo: false,
    });
    expect(vacio.ajustes.nombreLocal).toBe("Bar Paco");
    expect(vacio.empleados).toEqual([
      expect.objectContaining({ nombre: "Paco", rol: "encargado", pin: resumenPin("4321") }),
    ]);
    expect(vacio.productos).toHaveLength(0);
    expect(vacio.tickets).toHaveLength(0);
    const conCarta = estadoNuevo(contexto(), {
      nombre: "Bar Paco",
      encargado: "Paco",
      pin: "4321",
      conCartaDeEjemplo: true,
    });
    expect(conCarta.productos.length).toBeGreaterThan(20);
    const pasos = primerosPasos(vacio);
    expect(pasos.find((p) => p.clave === "carta")?.hecho).toBe(false);
    expect(pasos.find((p) => p.clave === "mesas")?.hecho).toBe(true);
  });

  it("los códigos de vinculación caducan y valen una sola vez", async () => {
    const { usarCodigoVinculo } = await import("@/lib/dominio/reducir");
    const t = preparar();
    t.hacer({ tipo: "crear_codigo_vinculo" }, t.ana);
    const { codigo, caduca } = t.estado.vinculos![0]!;
    expect(codigo).toMatch(/^\d{6}$/);
    expect(() => t.hacer({ tipo: "crear_codigo_vinculo" })).toThrow("encargado");
    expect(() => usarCodigoVinculo(t.estado, "000000", ctx.ahora)).toThrow("no vale");
    expect(() => usarCodigoVinculo(t.estado, codigo, caduca)).toThrow("caducado");
    const usado = usarCodigoVinculo(t.estado, codigo, ctx.ahora);
    expect(() => usarCodigoVinculo(usado, codigo, ctx.ahora)).toThrow();
  });
});
