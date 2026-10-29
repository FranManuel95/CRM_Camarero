import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { alertasEncargado } from "@/lib/dominio/alertas";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { cuentaDeMesa, reducirPersonal } from "@/lib/dominio/reducir";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { contexto } from "./ayuda";

const ctx = contexto();

describe("alertas del encargado", () => {
  it("avisa del descuadre, de muchas anulaciones y de las reservas por confirmar", () => {
    let estado: Estado = estadoDeEjemplo(ctx);
    const [ana, luis] = estado.empleados as [Empleado, Empleado];
    const hacer = (accion: AccionPersonal, quien = luis) => {
      estado = reducirPersonal(estado, accion, quien, ctx).estado;
    };
    estado.reservas = [];
    for (const i of estado.ingredientes) i.existencias = i.minimo + 10;
    expect(alertasEncargado(estado, ctx.ahora)).toEqual([]);

    hacer({ tipo: "abrir_caja", fondoInicial: 10000 }, ana);
    const mesa = estado.mesas.find((m) => m.nombre === "Mesa 6")!;
    hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2 });
    const cuentaId = cuentaDeMesa(estado, mesa.id)!.id;
    const linea = { productoId: "prod-5-1", cantidad: 1, opciones: [], nota: "" };
    hacer({ tipo: "anotar", cuentaId, lineas: [linea, linea, linea, linea, linea] });
    hacer({ tipo: "enviar_comanda", cuentaId });
    const lineas = cuentaDeMesa(estado, mesa.id)!.lineas;
    expect(lineas.length).toBe(1);
    hacer({ tipo: "anular_linea", cuentaId, lineaId: lineas[0]!.id, motivo: "Prueba" }, ana);
    hacer({ tipo: "anular_cuenta", cuentaId }, ana);
    hacer({ tipo: "cerrar_caja", efectivoContado: 9500 }, ana);
    estado.reservas.push({
      id: "r1",
      nombre: "Familia Ejemplo",
      telefono: "600000000",
      personas: 4,
      dia: "2099-01-01",
      hora: "21:00",
      mesaId: null,
      nota: "",
      estado: "por_confirmar",
      online: true,
      creadaEn: ctx.ahora,
    });

    const textos = alertasEncargado(estado, ctx.ahora).map((a) => a.texto.replace(/\s/g, " "));
    expect(textos).toContain("En el último cierre de caja faltaron 5,00 €.");
    expect(textos.some((t) => t.startsWith("Ana") && t.includes("5 anulaciones"))).toBe(true);
    expect(textos).toContain("Hay una reserva por confirmar: Familia Ejemplo, 4 personas.");
  });
});
