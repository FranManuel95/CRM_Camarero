import { describe, expect, it, vi } from "vitest";
import { estadoDeEjemplo } from "@/lib/dominio/demo";
import type { Estado } from "@/lib/dominio/tipos";
import { contexto } from "./ayuda";

vi.mock("server-only", () => ({}));

// Una base de datos de mentira con la misma regla que tpv_guardar_v2: solo guarda si la revisión
// no ha cambiado desde que se leyó (si no, devuelve -1).
const base = { revision: 1, datos: estadoDeEjemplo(contexto()) as Estado, guardados: 0 };
const espera = () => new Promise((ok) => setTimeout(ok, 2 + Math.random() * 8));
vi.mock("@/lib/servidor/supabase-rpc", () => ({
  rpc: vi.fn(async (funcion: string, args: Record<string, unknown>) => {
    await espera();
    if (funcion === "tpv_cargar_v3")
      return {
        revision: base.revision,
        datos: structuredClone(base.datos),
        tickets: [],
        ultimos: [],
        fichajes: [],
      };
    if (funcion === "tpv_guardar_v2") {
      if (args.p_revision !== base.revision) return -1;
      base.revision++;
      base.datos = args.p_datos as Estado;
      base.guardados++;
      return base.revision;
    }
    return [];
  }),
}));

const { almacenSupabase, enCola } = await import("@/lib/servidor/almacen-supabase");

describe("muchos aparatos a la vez en la nube", () => {
  it("la cola del servidor hace los cambios de un bar de uno en uno y en orden", async () => {
    const orden: number[] = [];
    await Promise.all(
      [1, 2, 3].map((n) =>
        enCola("bar", async () => {
          await espera();
          orden.push(n);
        }),
      ),
    );
    expect(orden).toEqual([1, 2, 3]);
    // Un fallo no atasca a los que vienen detrás.
    const malo = enCola("bar", async () => {
      throw new Error("falla");
    });
    await expect(malo).rejects.toThrow("falla");
    await expect(enCola("bar", async () => "sigue")).resolves.toBe("sigue");
  });

  it("20 cambios a la vez en el mismo bar se guardan todos, sin perder ninguno", async () => {
    const a = almacenSupabase("bar-concurrencia", false);
    const antes = base.guardados;
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        a.cambiar((estado) => {
          estado.gastos = [
            ...estado.gastos,
            { ...estado.gastos[0]!, id: `ensayo-${i}`, concepto: `Gasto ${i}` },
          ];
          return { estado, trabajos: [] };
        }),
      ),
    );
    expect(base.guardados - antes).toBe(20);
    const ensayo = base.datos.gastos.filter((g) => g.id.startsWith("ensayo-"));
    expect(ensayo).toHaveLength(20);
  });
});
