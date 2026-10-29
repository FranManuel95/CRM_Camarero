import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { migrar } from "@/lib/dominio/migraciones";
import {
  cuentaDeMesa,
  reducirCliente,
  reducirEncargoOnline,
  reducirPersonal,
  reducirReservaOnline,
} from "@/lib/dominio/reducir";
import { reservaCercana } from "@/lib/dominio/reservas";
import { pedidosCocina, pedidosParaLlevar } from "@/lib/dominio/selectores";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { vistaCliente } from "@/lib/servidor/vistas";
import { contexto } from "./ayuda";

// Las 21:00 en Madrid del 24/10/2026 (horario de verano).
const ctx = contexto("2026-10-24T19:00:00.000Z");

function preparar() {
  let estado: Estado = estadoDeEjemplo(ctx);
  const [ana, luis] = estado.empleados as [Empleado, Empleado];
  const hacer = (accion: AccionPersonal, quien = ana) => {
    estado = reducirPersonal(estado, accion, quien, ctx).estado;
  };
  const encender = (...funciones: ("pedidosOnline" | "reservasOnline" | "resenas")[]) => {
    for (const funcion of funciones) hacer({ tipo: "cambiar_funcion", funcion, activa: true });
  };
  hacer({ tipo: "abrir_caja", fondoInicial: 0 });
  return {
    get estado() {
      return estado;
    },
    set estado(e: Estado) {
      estado = e;
    },
    hacer,
    encender,
    ana,
    luis,
  };
}

const caña = { productoId: "prod-1-1", cantidad: 2, opciones: [], nota: "" };

describe("pedidos para llevar", () => {
  it("el camarero lo apunta, cocina lo ve con el nombre y se cobra como una mesa", () => {
    const t = preparar();
    t.hacer(
      { tipo: "abrir_para_llevar", nombre: "Lucía", telefono: "", recogida: "21:30" },
      t.luis,
    );
    const pedido = pedidosParaLlevar(t.estado)[0]!;
    expect(pedido.llevar?.nombre).toBe("Lucía");
    t.hacer({ tipo: "anotar", cuentaId: pedido.id, lineas: [caña] }, t.luis);
    t.hacer({ tipo: "enviar_comanda", cuentaId: pedido.id }, t.luis);
    const enBarra = pedidosCocina(t.estado, "todo").find((p) => p.cuenta.id === pedido.id);
    expect(enBarra?.nombre).toBe("Para llevar · Lucía, 21:30");
    expect(() =>
      t.hacer({ tipo: "mover_cuenta", cuentaId: pedido.id, mesaId: t.estado.mesas[0]!.id }),
    ).toThrow(/no se puede pasar/);
    t.hacer({
      tipo: "cobrar",
      cuentaId: pedido.id,
      pagos: [{ metodo: "efectivo", importe: 500 }],
    });
    expect(t.estado.tickets.at(-1)!.mesaNombre).toBe("Para llevar · Lucía, 21:30");
    expect(pedidosParaLlevar(t.estado)).toHaveLength(0);
  });

  it("apagado, no se pueden apuntar", () => {
    const t = preparar();
    t.hacer({ tipo: "cambiar_funcion", funcion: "paraLlevar", activa: false });
    expect(() =>
      t.hacer({ tipo: "abrir_para_llevar", nombre: "Lucía", telefono: "", recogida: "21:30" }),
    ).toThrow(/Pedidos para llevar/);
  });

  it("desde el móvil: se empieza, se pide con su enlace y el bar lo acepta", () => {
    const t = preparar();
    const datos = { nombre: "Óscar", telefono: "600 000 003", recogida: "21:45" };
    expect(() => reducirEncargoOnline(t.estado, datos, ctx)).toThrow(/no acepta encargos/);
    t.encender("pedidosOnline");
    expect(() => reducirEncargoOnline(t.estado, { ...datos, recogida: "20:00" }, ctx)).toThrow(
      /ya ha pasado/,
    );
    const r = reducirEncargoOnline(t.estado, datos, ctx);
    t.estado = r.estado;
    // Sin pedir nada todavía, no molesta en la sala.
    expect(pedidosParaLlevar(t.estado)).toHaveLength(0);
    const vista = vistaCliente(t.estado, r.token)!;
    expect(vista.mesa.nombre).toBe("Para llevar · Óscar, 21:45");
    expect(vista.llevar).toEqual({ recogida: "21:45" });
    t.estado = reducirCliente(t.estado, r.token, { tipo: "pedir", lineas: [caña] }, ctx).estado;
    const pedido = pedidosParaLlevar(t.estado)[0]!;
    expect(pedido.lineas[0]!.estado).toBe("por_confirmar");
    expect(() => reducirCliente(t.estado, r.token, { tipo: "llamar_camarero" }, ctx)).toThrow(
      /no hay camarero/,
    );
    t.hacer({ tipo: "aceptar_pedido_qr", cuentaId: pedido.id }, t.luis);
    expect(vistaCliente(t.estado, r.token)!.cuenta!.lineas[0]!.estado).toBe("enviada");
  });
});

describe("reservas", () => {
  it("se apuntan, se ven en el día y al sentarlas se abre su mesa", () => {
    const t = preparar();
    const mesa = t.estado.mesas.find((m) => m.nombre === "Mesa 6")!;
    t.hacer(
      {
        tipo: "guardar_reserva",
        reserva: {
          nombre: "Ejemplo",
          telefono: "600 000 004",
          personas: 3,
          dia: "2026-10-24",
          hora: "22:00",
          mesaId: mesa.id,
          nota: "",
        },
      },
      t.luis,
    );
    const reserva = t.estado.reservas.find((r) => r.nombre === "Ejemplo")!;
    expect(reserva.estado).toBe("confirmada");
    t.hacer({ tipo: "sentar_reserva", reservaId: reserva.id, mesaId: mesa.id }, t.luis);
    expect(cuentaDeMesa(t.estado, mesa.id)!.comensales).toBe(3);
    expect(t.estado.reservas.find((r) => r.id === reserva.id)!.estado).toBe("sentada");
    expect(() =>
      t.hacer({ tipo: "cambiar_reserva", reservaId: reserva.id, estado: "cancelada" }),
    ).toThrow(/cumplida/);
    expect(t.estado.historial.at(-1)?.texto).toMatch(/Apuntó una reserva de Ejemplo para 3/);
  });

  it("desde la web quedan por confirmar, con límite por teléfono", () => {
    const t = preparar();
    const datos = {
      nombre: "Web",
      telefono: "600 000 005",
      personas: 2,
      dia: "2026-10-25",
      hora: "14:00",
      nota: "",
    };
    expect(() => reducirReservaOnline(t.estado, datos, ctx)).toThrow(/no coge reservas/);
    t.encender("reservasOnline");
    expect(() =>
      reducirReservaOnline(t.estado, { ...datos, dia: "2026-10-24", hora: "20:00" }, ctx),
    ).toThrow(/ya ha pasado/);
    expect(() => reducirReservaOnline(t.estado, { ...datos, dia: "2027-03-01" }, ctx)).toThrow(
      /dos meses/,
    );
    for (let i = 0; i < 3; i++) t.estado = reducirReservaOnline(t.estado, datos, ctx).estado;
    expect(
      t.estado.reservas.filter((r) => r.nombre === "Web" && r.estado === "por_confirmar"),
    ).toHaveLength(3);
    expect(() => reducirReservaOnline(t.estado, { ...datos, telefono: "600000005" }, ctx)).toThrow(
      /pendientes/,
    );
  });
});

describe("reseñas y datos antiguos", () => {
  it("la carta invita a la reseña solo con la función encendida y un enlace", () => {
    const t = preparar();
    const token = t.estado.mesas[0]!.token;
    t.hacer({
      tipo: "guardar_ajustes",
      ajustes: { ...t.estado.ajustes, enlaceResena: "https://example.com/resena" },
    });
    expect(vistaCliente(t.estado, token)!.local.resena).toBeNull();
    t.encender("resenas");
    expect(vistaCliente(t.estado, token)!.local.resena).toBe("https://example.com/resena");
    // Guardar los ajustes sin el campo no borra el enlace.
    const { enlaceResena: _enlace, ...sinEnlace } = t.estado.ajustes;
    void _enlace;
    t.hacer({ tipo: "guardar_ajustes", ajustes: sinEnlace });
    expect(t.estado.ajustes.enlaceResena).toBe("https://example.com/resena");
  });

  it("los datos de la versión 5 se ponen al día sin reservas", () => {
    const { reservas: _r, pagosOnline: _p, ...viejo } = estadoDeEjemplo(ctx);
    void [_r, _p];
    const migrado = migrar({ ...viejo, version: 5 } as Estado);
    expect(migrado.reservas).toEqual([]);
    expect(migrado.pagosOnline).toEqual([]);
  });
});

describe("reserva en el plano", () => {
  it("se ve en su mesa desde dos horas antes hasta tres cuartos después", () => {
    const { reservas, mesas } = estadoDeEjemplo(ctx);
    const mesa4 = mesas.find((m) => m.nombre === "Mesa 4")!.id;
    // La de ejemplo es a las 21:00 (19:00 UTC).
    expect(reservaCercana(reservas, mesa4, "2026-10-24T16:30:00.000Z")).toBeUndefined();
    expect(reservaCercana(reservas, mesa4, "2026-10-24T17:30:00.000Z")?.id).toBe("res-1");
    expect(reservaCercana(reservas, mesa4, "2026-10-24T19:40:00.000Z")?.id).toBe("res-1");
    expect(reservaCercana(reservas, mesa4, "2026-10-24T19:50:00.000Z")).toBeUndefined();
  });
});
