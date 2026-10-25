import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { activa, disponible, LISTA_FUNCIONES } from "@/lib/dominio/funciones";
import { cuentaDeMesa, reducirPersonal } from "@/lib/dominio/reducir";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { vistaCliente } from "@/lib/servidor/vistas";
import { contexto } from "./ayuda";

const ctx = contexto();

function preparar() {
  let estado: Estado = estadoDeEjemplo(ctx);
  const [ana, luis] = estado.empleados as [Empleado, Empleado];
  const hacer = (accion: AccionPersonal, quien = ana) => {
    estado = reducirPersonal(estado, accion, quien, ctx).estado;
  };
  hacer({ tipo: "abrir_caja", fondoInicial: 0 });
  const apagar = (funcion: (typeof LISTA_FUNCIONES)[number]) =>
    hacer({ tipo: "cambiar_funcion", funcion, activa: false });
  return {
    get estado() {
      return estado;
    },
    hacer,
    apagar,
    ana,
    luis,
  };
}

const caña = { productoId: "prod-1-1", cantidad: 1, opciones: [], nota: "" };

describe("funciones", () => {
  it("lo de dentro del bar viene encendido, y lo que necesita una clave solo se usa con ella", () => {
    const { ajustes } = estadoDeEjemplo(ctx);
    // Lo que abre el bar a los clientes por internet se enciende a propósito.
    const apagadas = ["reservasOnline", "pedidosOnline", "resenas", "verifactu"];
    expect(LISTA_FUNCIONES.filter((f) => !activa(ajustes, f))).toEqual(apagadas);
    expect(disponible(ajustes, { ia: false }, "facturasConFoto")).toBe(false);
    expect(disponible(ajustes, { ia: true }, "facturasConFoto")).toBe(true);
  });

  it("solo el encargado las cambia, y guardar los ajustes no las pisa", () => {
    const t = preparar();
    expect(() =>
      t.hacer({ tipo: "cambiar_funcion", funcion: "stock", activa: false }, t.luis),
    ).toThrow(/encargado/);
    t.apagar("propinas");
    t.hacer({ tipo: "guardar_ajustes", ajustes: { ...t.estado.ajustes, nombreLocal: "Otro" } });
    expect(activa(t.estado.ajustes, "propinas")).toBe(false);
    expect(t.estado.ajustes.nombreLocal).toBe("Otro");
  });

  it("apagadas, sus acciones se rechazan con un mensaje claro", () => {
    const t = preparar();
    t.apagar("ventaRapida");
    expect(() =>
      t.hacer({
        tipo: "venta_rapida",
        lineas: [caña],
        pagos: [{ metodo: "tarjeta", importe: 200 }],
      }),
    ).toThrow(/Venta rápida» está apagado/);
    t.apagar("fichajes");
    expect(() => t.hacer({ tipo: "fichar", que: "entrada" }, t.luis)).toThrow(/Fichajes/);
  });

  it("sin propinas ni cobro por platos, el cobro normal sigue funcionando", () => {
    const t = preparar();
    t.apagar("propinas");
    t.apagar("cobrarPorPartes");
    const mesa = t.estado.mesas[0]!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 1 });
    const cuentaId = cuentaDeMesa(t.estado, mesa.id)!.id;
    t.hacer({ tipo: "anotar", cuentaId, lineas: [{ ...caña, cantidad: 2 }] });
    t.hacer({ tipo: "enviar_comanda", cuentaId });
    const lineaId = cuentaDeMesa(t.estado, mesa.id)!.lineas[0]!.id;
    const pagos = [{ metodo: "tarjeta" as const, importe: 400 }];
    expect(() => t.hacer({ tipo: "cobrar", cuentaId, pagos, propina: 50 })).toThrow(/Propinas/);
    expect(() =>
      t.hacer({ tipo: "cobrar", cuentaId, pagos, partes: [{ lineaId, cantidad: 1 }] }),
    ).toThrow(/Cobrar por platos/);
    t.hacer({ tipo: "cobrar", cuentaId, pagos });
    expect(t.estado.tickets).toHaveLength(1);
  });

  it("sin «para después», lo anotado como después va normal", () => {
    const t = preparar();
    t.apagar("paraDespues");
    const mesa = t.estado.mesas[0]!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 1 });
    const cuentaId = cuentaDeMesa(t.estado, mesa.id)!.id;
    t.hacer({ tipo: "anotar", cuentaId, lineas: [{ ...caña, despues: true }] });
    expect(cuentaDeMesa(t.estado, mesa.id)!.lineas[0]!.despues).toBeUndefined();
  });

  it("sin stock no se descuenta nada y lo agotado por el stock vuelve a la carta", () => {
    const t = preparar();
    t.hacer({
      tipo: "ajustar_stock",
      ingredienteId: "ing-pulpo",
      ajuste: "recuento",
      cantidad: 0,
      nota: "",
    });
    const pulpo = () => t.estado.productos.find((p) => p.nombre === "Pulpo a la gallega")!;
    expect(pulpo().disponible).toBe(false);
    t.apagar("stock");
    expect(pulpo().disponible).toBe(true);
    const cerveza = t.estado.ingredientes.find((i) => i.id === "ing-cerveza")!.existencias;
    const mesa = t.estado.mesas[0]!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 1 });
    const cuentaId = cuentaDeMesa(t.estado, mesa.id)!.id;
    t.hacer({ tipo: "anotar", cuentaId, lineas: [caña] });
    t.hacer({ tipo: "enviar_comanda", cuentaId });
    expect(t.estado.ingredientes.find((i) => i.id === "ing-cerveza")!.existencias).toBe(cerveza);
    // Al volver a encender, el stock manda otra vez.
    t.hacer({ tipo: "cambiar_funcion", funcion: "stock", activa: true });
    expect(pulpo().disponible).toBe(false);
  });

  it("la carta QR solo ofrece inglés si está encendido", () => {
    const t = preparar();
    const token = t.estado.mesas[0]!.token;
    expect(vistaCliente(t.estado, token)!.local.ingles).toBe(true);
    t.apagar("cartaIngles");
    expect(vistaCliente(t.estado, token)!.local.ingles).toBe(false);
  });
});
