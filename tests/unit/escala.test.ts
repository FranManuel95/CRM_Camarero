import { describe, expect, it, vi } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { cuentaDeMesa, reducirPersonal } from "@/lib/dominio/reducir";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { contexto } from "./ayuda";

vi.mock("server-only", () => ({}));
const { crearLimiteDeFallos } = await import("@/lib/servidor/limite");
const { vistaPersonal } = await import("@/lib/servidor/vistas");

const ctx = contexto();

describe("intentos de PIN", () => {
  it("tras demasiados fallos se corta antes de mirar el PIN, y cada sitio cuenta aparte", async () => {
    const limite = crearLimiteDeFallos("prueba", 3, 60_000);
    expect(await limite.bloqueado("ip1|bar")).toBe(false);
    for (let i = 0; i < 3; i++) await limite.fallo("ip1|bar");
    expect(await limite.bloqueado("ip1|bar")).toBe(true);
    expect(await limite.bloqueado("ip2|bar")).toBe(false);
  });
});

describe("con solo los tickets de las últimas horas", () => {
  function preparar() {
    let estado: Estado = estadoDeEjemplo(ctx, { conHistorial: true });
    const [ana, luis] = estado.empleados as [Empleado, Empleado];
    const hacer = (accion: AccionPersonal, quien = luis) => {
      estado = reducirPersonal(estado, accion, quien, ctx).estado;
    };
    return {
      get estado() {
        return estado;
      },
      set estado(e: Estado) {
        estado = e;
      },
      hacer,
      ana,
    };
  }

  it("sigue la numeración con el último ticket de la serie, aunque no esté en la lista", () => {
    const t = preparar();
    const ultimo = t.estado.tickets.at(-1)!;
    // Como llega de la nube: sin los tickets viejos, con el último de cada serie aparte.
    t.estado = { ...t.estado, tickets: [], ultimosTickets: [ultimo], ticketsDesde: ctx.ahora };
    const mesa = t.estado.mesas.find((m) => !cuentaDeMesa(t.estado, m.id))!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2 });
    const cuentaId = cuentaDeMesa(t.estado, mesa.id)!.id;
    t.hacer({
      tipo: "anotar",
      cuentaId,
      lineas: [{ productoId: "prod-1-1", cantidad: 1, opciones: [], nota: "" }],
    });
    t.hacer({ tipo: "enviar_comanda", cuentaId });
    t.hacer({ tipo: "cobrar", cuentaId, pagos: [{ metodo: "tarjeta", importe: 200 }] });
    const nuevo = t.estado.tickets.at(-1)!;
    expect(nuevo.serie).toBe(ultimo.serie);
    expect(nuevo.secuencia).toBe(ultimo.secuencia + 1);
  });

  it("el cierre guarda sus cifras, y los cierres viejos sin ellas no se inventan", () => {
    const t = preparar();
    t.hacer({ tipo: "cerrar_caja", efectivoContado: 15000 }, t.ana);
    const cerrado = t.estado.turnos.find((x) => x.cerradoEn === ctx.ahora)!;
    expect(cerrado.cifras).toMatchObject({
      tickets: expect.any(Number),
      ventas: expect.any(Number),
    });

    const viejo = { ...t.estado.turnos.find((x) => x.cerradoEn && x.id !== cerrado.id)! };
    delete viejo.cifras;
    const enLaNube: Estado = {
      ...t.estado,
      turnos: [viejo, cerrado],
      ticketsDesde: new Date(Date.parse(ctx.ahora) - 36 * 3_600_000).toISOString(),
    };
    const vista = vistaPersonal(enLaNube, "local", t.ana, Date.parse(ctx.ahora));
    expect(vista.turnos.find((x) => x.id === viejo.id)!.cifras).toBeNull();
    expect(vista.turnos.find((x) => x.id === cerrado.id)!.cifras).toEqual(cerrado.cifras);
  });
});
