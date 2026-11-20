import { describe, expect, it, vi } from "vitest";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { masPedidos, mezclarRapidos } from "@/lib/dominio/rapidos";
import { reducirPersonal } from "@/lib/dominio/reducir";
import type { Estado } from "@/lib/dominio/tipos";
import { contexto } from "./ayuda";

vi.mock("server-only", () => ({}));
const { vistaCliente, vistaPersonal } = await import("@/lib/servidor/vistas");

const ctx = contexto();
const ahora = Date.parse(ctx.ahora);

function bar() {
  let estado: Estado = estadoDeEjemplo(ctx, { conHistorial: true });
  const encargado = estado.empleados.find((e) => e.rol === "encargado")!;
  const camarero = estado.empleados.find((e) => e.rol === "camarero")!;
  const favorito = (productoId: string, favorito = true) => {
    estado = reducirPersonal(
      estado,
      { tipo: "marcar_favorito", productoId, favorito },
      encargado,
      ctx,
    ).estado;
  };
  return { estado: () => estado, encargado, camarero, favorito };
}

describe("rápidos y favoritos", () => {
  it("mezcla: favoritos siempre, luego lo suyo (hasta 6) y lo del bar, sin repetir", () => {
    const r = mezclarRapidos({
      favoritos: ["Menú del día"],
      suyos: ["Vermut", "Caña", "a", "b", "c", "d", "e"],
      bar: ["Caña", "Café", "Tostada"],
    });
    expect(r.slice(0, 2)).toEqual(["Menú del día", "Vermut"]);
    expect(r.filter((n) => n === "Caña")).toHaveLength(1);
    expect(r).not.toContain("e");
    expect(r).toContain("Café");
    expect(mezclarRapidos({ favoritos: ["x", "y"], suyos: [], bar: ["z"], max: 2 })).toEqual([
      "x",
      "y",
    ]);
  });

  it("el favorito del encargado sale el primero en «Rápidos» de todos, y se puede quitar", () => {
    const t = bar();
    const poco = [...t.estado().productos].sort((a, b) => a.orden - b.orden).at(-1)!;
    t.favorito(poco.id);
    const vista = vistaPersonal(t.estado(), "local", t.camarero, ahora);
    expect(vista.rapidos[0]).toBe(poco.nombre);
    t.favorito(poco.id, false);
    expect(t.estado().productos.find((p) => p.id === poco.id)!.favorito).toBeUndefined();
  });

  it("cada camarero ve primero lo que más pide él", () => {
    const t = bar();
    const e = t.estado();
    const suyos = masPedidos(e.tickets, ctx.ahora, 6, t.camarero.id);
    expect(suyos.length).toBeGreaterThan(0);
    // En la nube llega calculado de la base de datos por persona.
    const enLaNube: Estado = {
      ...e,
      masPedidos: ["Bar 1", "Bar 2"],
      masPedidosEquipo: { [t.camarero.id]: ["Solo mío"] },
    };
    const vista = vistaPersonal(enLaNube, "local", t.camarero, ahora);
    expect(vista.rapidos).toEqual(["Solo mío", "Bar 1", "Bar 2"]);
    expect("masPedidosEquipo" in vista).toBe(false);
    const otro = vistaPersonal(enLaNube, "local", t.encargado, ahora);
    expect(otro.rapidos[0]).not.toBe("Solo mío");
  });

  it("la carta QR destaca lo más pedido que se puede pedir, con los favoritos delante", () => {
    const t = bar();
    const favorito = t.estado().productos.find((p) => p.disponible && !p.oculto)!;
    t.favorito(favorito.id);
    const oculto = t.estado().productos.find((p) => p.id !== favorito.id)!;
    const e = { ...t.estado(), masPedidos: [oculto.nombre] };
    e.productos = e.productos.map((p) => (p.id === oculto.id ? { ...p, oculto: true } : p));
    const vista = vistaCliente(e, e.mesas.find((m) => m.token)!.token, ctx.ahora)!;
    expect(vista.destacados[0]).toBe(favorito.id);
    expect(vista.destacados).not.toContain(oculto.id);
    expect(vista.destacados.length).toBeLessThanOrEqual(6);
  });
});
