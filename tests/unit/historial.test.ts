import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { euros } from "@/lib/dominio/importes";
import { cuentaDeMesa, reducirPersonal } from "@/lib/dominio/reducir";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { vistaPersonal } from "@/lib/servidor/vistas";
import { contexto } from "./ayuda";

const ctx = contexto();

function preparar() {
  let estado: Estado = estadoDeEjemplo(ctx);
  const [ana, luis] = estado.empleados as [Empleado, Empleado];
  const hacer = (accion: AccionPersonal, quien = ana) => {
    estado = reducirPersonal(estado, accion, quien, ctx).estado;
  };
  return {
    get estado() {
      return estado;
    },
    hacer,
    ana,
    luis,
  };
}

describe("historial de cambios", () => {
  it("apunta lo importante con quién y una frase; lo del día a día no", () => {
    const t = preparar();
    const mesa = t.estado.mesas.find((m) => m.nombre === "Mesa 4")!;
    t.hacer({ tipo: "abrir_cuenta", mesaId: mesa.id, comensales: 2 }, t.luis);
    const cuentaId = cuentaDeMesa(t.estado, mesa.id)!.id;
    t.hacer(
      {
        tipo: "anotar",
        cuentaId,
        lineas: [{ productoId: "prod-5-2", cantidad: 1, opciones: [], nota: "" }],
      },
      t.luis,
    );
    t.hacer({ tipo: "enviar_comanda", cuentaId }, t.luis);
    const lineaId = cuentaDeMesa(t.estado, mesa.id)!.lineas[0]!.id;
    t.hacer({ tipo: "anular_linea", cuentaId, lineaId, motivo: "Se ha caído" }, t.luis);
    t.hacer({ tipo: "aplicar_descuento", cuentaId, descuento: 10 }, t.luis);
    expect(t.estado.historial.map((h) => [h.empleadoId, h.texto])).toEqual([
      [t.luis.id, "Anuló 1 Patatas bravas en Mesa 4 («Se ha caído»)"],
      [t.luis.id, "Puso un 10 % de descuento en Mesa 4"],
    ]);
  });

  it("cuenta los cambios de precio con el antes y el después", () => {
    const t = preparar();
    const caña = t.estado.productos.find((p) => p.nombre === "Caña")!;
    const { id, agotadoPorStock: _a, ...datos } = caña;
    void _a;
    t.hacer({ tipo: "guardar_producto", producto: { ...datos, id, precio: 220 } });
    expect(t.estado.historial.at(-1)!.texto).toBe(
      `Cambió el precio de Caña de ${euros(200)} a ${euros(220)}`,
    );
  });

  it("apagado no apunta nada, salvo que se ha apagado", () => {
    const t = preparar();
    t.hacer({ tipo: "cambiar_funcion", funcion: "historial", activa: false });
    t.hacer({ tipo: "abrir_caja", fondoInicial: 10000 });
    expect(t.estado.historial.map((h) => h.texto)).toEqual(["Apagó «Historial de cambios»"]);
  });

  it("solo lo ve el encargado", () => {
    const t = preparar();
    t.hacer({ tipo: "abrir_caja", fondoInicial: 10000 });
    const ahora = Date.parse(ctx.ahora);
    expect(vistaPersonal(t.estado, "local", t.ana, ahora).historial).toHaveLength(1);
    expect(vistaPersonal(t.estado, "local", t.luis, ahora).historial).toEqual([]);
  });
});
