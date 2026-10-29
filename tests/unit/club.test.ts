import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { buscarClientes, resumenClub } from "@/lib/dominio/club";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { totalCuenta } from "@/lib/dominio/importes";
import {
  cuentaDeMesa,
  reducirAltaClub,
  reducirCliente,
  reducirPersonal,
} from "@/lib/dominio/reducir";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { aTexto } from "@/lib/impresion/documento";
import { vistaCliente } from "@/lib/servidor/vistas";
import { contexto } from "./ayuda";

const ctx = contexto();
const croquetas = (cantidad = 1) => ({ productoId: "prod-5-1", cantidad, opciones: [], nota: "" });

function preparar() {
  let estado: Estado = estadoDeEjemplo(ctx);
  const [ana, luis] = estado.empleados as [Empleado, Empleado];
  const hacer = (accion: AccionPersonal, quien = luis) => {
    const r = reducirPersonal(estado, accion, quien, ctx);
    estado = r.estado;
    return r;
  };
  hacer({ tipo: "cambiar_funcion", funcion: "club", activa: true }, ana);
  hacer({ tipo: "abrir_caja", fondoInicial: 0 }, ana);
  const mesa = estado.mesas.find((m) => m.nombre === "Mesa 6")!;
  hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2 });
  const cuenta = () => cuentaDeMesa(estado, mesa.id)!;
  return {
    get estado() {
      return estado;
    },
    set estado(e: Estado) {
      estado = e;
    },
    hacer,
    ana,
    luis,
    mesa,
    cuenta,
  };
}

const lucia = {
  nombre: "Lucía Ejemplo",
  telefono: "600 000 020",
  correo: "",
  alergenos: [],
  comunicaciones: true,
  nota: "",
};

describe("club de clientes", () => {
  it("el camarero la apunta con su consentimiento y la encuentra por teléfono", () => {
    const t = preparar();
    expect(() => t.hacer({ tipo: "guardar_cliente", cliente: lucia })).toThrow(/acepte/);
    t.hacer({ tipo: "guardar_cliente", cliente: lucia, consentimiento: true });
    const cliente = t.estado.clientes[0]!;
    expect(cliente).toMatchObject({ puntos: 10, consentimiento: { via: "personal" } });
    expect(buscarClientes(t.estado.clientes, "000 020")[0]?.id).toBe(cliente.id);
    expect(buscarClientes(t.estado.clientes, "lucía")[0]?.id).toBe(cliente.id);
    expect(() =>
      t.hacer({
        tipo: "guardar_cliente",
        cliente: { ...lucia, nombre: "Otra", telefono: "+34 600000020" },
        consentimiento: true,
      }),
    ).toThrow(/ya es de Lucía/);
  });

  it("al cobrar suma puntos, visita y favoritos; con 100 puntos canjea 5 €", () => {
    const t = preparar();
    t.hacer({ tipo: "guardar_cliente", cliente: lucia, consentimiento: true });
    const id = t.estado.clientes[0]!.id;
    t.hacer({ tipo: "asignar_cliente", cuentaId: t.cuenta().id, clienteId: id });
    t.hacer({ tipo: "anotar", cuentaId: t.cuenta().id, lineas: [croquetas(2)] });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuenta().id });
    expect(() =>
      t.hacer({ tipo: "canjear_puntos", cuentaId: t.cuenta().id, canjear: true }),
    ).toThrow(/faltan 90 puntos/i);
    const r = t.hacer({
      tipo: "cobrar",
      cuentaId: t.cuenta().id,
      pagos: [{ metodo: "tarjeta", importe: 1300 }],
    });
    const cliente = t.estado.clientes[0]!;
    expect(cliente).toMatchObject({ puntos: 23, visitas: 1, gastado: 1300 });
    expect(cliente.favoritos).toEqual({ "Croquetas de jamón (4 uds.)": 2 });
    expect(aTexto(r.trabajos.find((j) => j.tipo === "ticket")!.documento, 48)).toContain(
      "Club: Lucía, +13 puntos. Tienes 23.",
    );

    // Otra visita con puntos de sobra: canjea el premio.
    t.estado.clientes[0]!.puntos = 120;
    t.hacer({ tipo: "abrir_cuenta", mesaId: t.mesa.id, comensales: 1 });
    t.hacer({ tipo: "asignar_cliente", cuentaId: t.cuenta().id, clienteId: id });
    t.hacer({ tipo: "anotar", cuentaId: t.cuenta().id, lineas: [croquetas(1)] });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuenta().id });
    t.hacer({ tipo: "canjear_puntos", cuentaId: t.cuenta().id, canjear: true });
    expect(totalCuenta(t.cuenta())).toBe(150);
    t.hacer({
      tipo: "cobrar",
      cuentaId: t.cuenta().id,
      pagos: [{ metodo: "efectivo", importe: 150 }],
    });
    const ticket = t.estado.tickets.at(-1)!;
    expect(ticket).toMatchObject({ total: 150, canjeClub: 500 });
    expect(ticket.desglose.reduce((s, d) => s + d.total, 0)).toBe(150);
    // 120 + 1 (por 1,50 €) − 100 del premio
    expect(t.estado.clientes[0]).toMatchObject({ puntos: 21, visitas: 2 });
  });

  it("desde el QR: se apunta, su mesa ya suma puntos y lo ve en la carta", () => {
    const t = preparar();
    t.hacer({ tipo: "anotar", cuentaId: t.cuenta().id, lineas: [croquetas()] });
    t.hacer({ tipo: "enviar_comanda", cuentaId: t.cuenta().id });
    const alta = { ...lucia, acepto: true as const, mesa: t.mesa.token };
    const r = reducirAltaClub(t.estado, alta, ctx);
    t.estado = r.estado;
    expect(t.estado.clientes[0]!.consentimiento.via).toBe("qr");
    expect(t.cuenta().clienteId).toBe(t.estado.clientes[0]!.id);
    const vista = vistaCliente(t.estado, t.mesa.token)!;
    expect(vista.cuenta!.club).toBe("Lucía");
    expect(vista.local.club).toMatchObject({ puntosPremio: 100 });
    expect(() => reducirAltaClub(t.estado, alta, ctx)).toThrow(/ya está en el club/);
    // Con la tarjeta, otra mesa se suma desde la carta.
    const otra = t.estado.mesas.find((m) => m.nombre === "Mesa 7")!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: otra.id, comensales: 1 });
    t.estado = reducirCliente(
      t.estado,
      otra.token,
      { tipo: "sumar_al_club", codigo: r.codigo },
      ctx,
    ).estado;
    expect(cuentaDeMesa(t.estado, otra.id)!.clienteId).toBe(t.estado.clientes[0]!.id);
  });

  it("la baja borra sus datos, y el resumen cuenta altas, repetidores y dormidos", () => {
    const t = preparar();
    t.hacer({ tipo: "guardar_cliente", cliente: lucia, consentimiento: true });
    const id = t.estado.clientes[0]!.id;
    t.hacer({ tipo: "asignar_cliente", cuentaId: t.cuenta().id, clienteId: id });
    expect(resumenClub(t.estado.clientes, ctx.ahora)).toMatchObject({
      total: 1,
      nuevos: 1,
      conOfertas: 1,
    });
    expect(() => t.hacer({ tipo: "baja_cliente", clienteId: id })).toThrow(/encargado/);
    t.hacer({ tipo: "baja_cliente", clienteId: id }, t.ana);
    expect(t.estado.clientes).toEqual([]);
    expect(t.cuenta().clienteId).toBeUndefined();
    expect(t.estado.historial.at(-1)!.texto).not.toContain("Lucía");
  });
});
