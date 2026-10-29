import { describe, expect, it } from "vitest";
import type { AccionPersonal } from "@/lib/dominio/acciones";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { reducirPersonal } from "@/lib/dominio/reducir";
import { nombreCorto, pantallaPedidos } from "@/lib/dominio/selectores";
import type { Empleado, Estado } from "@/lib/dominio/tipos";
import { contexto } from "./ayuda";

const ctx = contexto();

describe("pantalla de pedidos para los clientes", () => {
  it("acorta el nombre", () => {
    expect(nombreCorto("  lucía martín ejemplo ")).toBe("lucía M.");
    expect(nombreCorto("Pablo")).toBe("Pablo");
  });

  it("pasa de «Preparando» a «Listo» y desaparece al entregarlo", () => {
    let estado: Estado = estadoDeEjemplo(ctx);
    estado.cuentas = estado.cuentas.filter((c) => !c.llevar);
    const [, luis] = estado.empleados as [Empleado, Empleado];
    const hacer = (accion: AccionPersonal) => {
      estado = reducirPersonal(estado, accion, luis, ctx).estado;
    };
    hacer({ tipo: "abrir_caja", fondoInicial: 0 });
    hacer({
      tipo: "abrir_para_llevar",
      nombre: "Lucía Ejemplo",
      telefono: "",
      recogida: "21:15",
      cuentaId: "sr-1",
    });
    const cuenta = () => estado.cuentas.find((c) => c.id === "sr-1")!;
    hacer({
      tipo: "anotar",
      cuentaId: "sr-1",
      lineas: [{ productoId: "prod-5-1", cantidad: 1, opciones: [], nota: "" }],
    });
    expect(pantallaPedidos(estado)).toEqual({ preparando: [], listos: [] });
    hacer({ tipo: "enviar_comanda", cuentaId: "sr-1" });
    expect(pantallaPedidos(estado).preparando).toEqual([{ id: "sr-1", nombre: "Lucía E." }]);
    const lineaIds = cuenta().lineas.map((l) => l.id);
    hacer({ tipo: "marcar_lista", cuentaId: "sr-1", lineaIds });
    expect(pantallaPedidos(estado).listos).toEqual([{ id: "sr-1", nombre: "Lucía E." }]);
    hacer({ tipo: "marcar_servida", cuentaId: "sr-1", lineaIds });
    expect(pantallaPedidos(estado)).toEqual({ preparando: [], listos: [] });
  });
});
