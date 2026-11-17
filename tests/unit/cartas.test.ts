import { describe, expect, it, vi } from "vitest";
import { accionPersonal } from "@/lib/dominio/acciones";
import {
  cartaInicial,
  cartasDisponibles,
  categoriaEnServicio,
  categoriasVisibles,
} from "@/lib/dominio/cartas";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import { reducirCliente, reducirPersonal } from "@/lib/dominio/reducir";
import type { Estado } from "@/lib/dominio/tipos";
import { contexto } from "./ayuda";

vi.mock("server-only", () => ({}));
const { vistaCliente } = await import("@/lib/servidor/vistas");

// Sábado 24/10/2026 en hora de Madrid (UTC+2).
const a = (hora: string) => new Date(`2026-10-24T${hora}:00+02:00`).toISOString();

function conCartas() {
  const ctx = contexto();
  let estado: Estado = estadoDeEjemplo(ctx);
  const ana = estado.empleados.find((e) => e.rol === "encargado")!;
  const [primera, segunda, tercera] = [...estado.categorias].sort((x, y) => x.orden - y.orden);
  const hacer = (accion: unknown) => {
    const ok = accionPersonal.safeParse(accion);
    if (!ok.success) throw ok.error;
    estado = reducirPersonal(estado, ok.data, ana, ctx).estado;
  };
  hacer({
    tipo: "guardar_carta_horaria",
    carta: {
      nombre: "Desayunos",
      horario: { desde: "07:00", hasta: "12:30", dias: [] },
      categoriaIds: [primera!.id],
    },
  });
  hacer({
    tipo: "guardar_carta_horaria",
    carta: {
      nombre: "Cenas",
      horario: { desde: "20:00", hasta: "00:00", dias: [] },
      categoriaIds: [segunda!.id, primera!.id],
    },
  });
  return {
    estado: () => estado,
    hacer,
    primera: primera!,
    segunda: segunda!,
    tercera: tercera!,
    ana,
    ctx,
  };
}

describe("cartas", () => {
  it("sin horario: solo un nombre y sus categorías, siempre disponibles y elegidas a mano", () => {
    const ctx = contexto();
    let estado: Estado = estadoDeEjemplo(ctx);
    const ana = estado.empleados.find((e) => e.rol === "encargado")!;
    const [primera, segunda, tercera] = [...estado.categorias].sort((x, y) => x.orden - y.orden);
    for (const [nombre, cat] of [
      ["Comidas", primera!],
      ["Copas", segunda!],
    ] as const) {
      const ok = accionPersonal.safeParse({
        tipo: "guardar_carta_horaria",
        carta: { nombre, categoriaIds: [cat.id] },
      });
      if (!ok.success) throw ok.error;
      estado = reducirPersonal(estado, ok.data, ana, ctx).estado;
    }
    expect(cartasDisponibles(estado, a("04:00")).map((c) => c.nombre)).toEqual([
      "Comidas",
      "Copas",
    ]);
    const copas = estado.cartas!.find((c) => c.nombre === "Copas")!.id;
    // Sin horario, empieza por la primera.
    expect(cartaInicial(estado, a("09:00"))).toBe(estado.cartas![0]!.id);
    const ids = categoriasVisibles(estado, copas, a("09:00")).map((c) => c.id);
    expect(ids).toContain(segunda!.id);
    expect(ids).not.toContain(primera!.id);
    expect(ids).toContain(tercera!.id);
    // Todo se puede pedir desde el QR a cualquier hora.
    expect(estado.categorias.every((c) => categoriaEnServicio(estado, c, a("04:00")))).toBe(true);
    const vista = vistaCliente(estado, estado.mesas.find((m) => m.token)!.token, a("09:00"))!;
    expect(vista.cartas.map((c) => c.nombre)).toEqual(["Comidas", "Copas"]);
  });

  it("cada carta a su hora; lo que no está en ninguna, siempre", () => {
    const t = conCartas();
    const e = t.estado();
    const ids = (hora: string) => categoriasVisibles(e, "ahora", a(hora)).map((c) => c.id);
    // A las 9: desayunos (primera) y lo que no tiene carta (tercera), pero no la de cenas.
    expect(ids("09:00")).toContain(t.primera.id);
    expect(ids("09:00")).not.toContain(t.segunda.id);
    expect(ids("09:00")).toContain(t.tercera.id);
    // A las 21: cenas (segunda y también primera, que está en las dos).
    expect(ids("21:00")).toEqual(
      expect.arrayContaining([t.primera.id, t.segunda.id, t.tercera.id]),
    );
    // A media tarde no toca ninguna: solo lo que no tiene carta.
    expect(ids("17:00")).not.toContain(t.primera.id);
    expect(ids("17:00")).toContain(t.tercera.id);
    // El camarero puede abrir una carta concreta o toda.
    const cenas = e.cartas!.find((c) => c.nombre === "Cenas")!.id;
    expect(categoriasVisibles(e, cenas, a("09:00")).map((c) => c.id)).toContain(t.segunda.id);
    expect(categoriasVisibles(e, "toda", a("09:00"))).toHaveLength(e.categorias.length);
  });

  it("si todo tiene carta y no toca ninguna, se enseña todo (la carta nunca queda vacía)", () => {
    const t = conCartas();
    t.hacer({
      tipo: "guardar_carta_horaria",
      carta: {
        nombre: "Resto",
        horario: { desde: "13:00", hasta: "16:00", dias: [] },
        categoriaIds: t.estado().categorias.map((c) => c.id),
      },
    });
    const e = t.estado();
    expect(e.categorias.every((c) => categoriaEnServicio(e, c, a("17:30")))).toBe(true);
  });

  it("el QR solo enseña y deja pedir la carta que toca", () => {
    const t = conCartas();
    const e = t.estado();
    const mesa = e.mesas.find((m) => m.token)!;
    const desayuno = e.productos.find(
      (p) => p.categoriaId === t.segunda.id && p.disponible && !p.grupos.length,
    )!;
    const vista = vistaCliente(e, mesa.token, a("09:00"))!;
    expect(vista.cartas.map((c) => c.nombre)).toEqual(["Desayunos"]);
    expect(vista.productos.some((p) => p.id === desayuno.id)).toBe(false);
    expect(() =>
      reducirCliente(
        e,
        mesa.token,
        {
          tipo: "pedir",
          lineas: [{ productoId: desayuno.id, cantidad: 1, opciones: [], nota: "" }],
        },
        { ...t.ctx, ahora: a("09:00") },
      ),
    ).toThrow(/no se sirve a esta hora/);
  });

  it("no repite nombres, y al borrar una categoría sale de las cartas", () => {
    const t = conCartas();
    expect(() =>
      t.hacer({
        tipo: "guardar_carta_horaria",
        carta: {
          nombre: "desayunos",
          horario: { desde: "08:00", hasta: "10:00", dias: [] },
          categoriaIds: [t.tercera.id],
        },
      }),
    ).toThrow(/Ya hay una carta/);
    const vacia = {
      ...t.estado(),
      productos: t.estado().productos.filter((p) => p.categoriaId !== t.segunda.id),
    };
    const r = reducirPersonal(
      vacia,
      { tipo: "borrar_categoria", categoriaId: t.segunda.id },
      t.ana,
      t.ctx,
    ).estado;
    expect(r.cartas!.flatMap((c) => c.categoriaIds)).not.toContain(t.segunda.id);
    const borrar = r.cartas![0]!.id;
    const sin = reducirPersonal(
      r,
      { tipo: "borrar_carta_horaria", cartaId: borrar },
      t.ana,
      t.ctx,
    ).estado;
    expect(sin.cartas).toHaveLength(1);
  });
});
