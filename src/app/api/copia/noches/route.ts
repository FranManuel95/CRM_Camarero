import { activa } from "@/lib/dominio/funciones";
import { enLaNube, leerEstado } from "@/lib/servidor/almacen";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";
import { rpc } from "@/lib/servidor/supabase-rpc";

export const dynamic = "force-dynamic";

type Noche = { dia: string; creada: string; bytes: number };

/**
 * Copias que la base de datos hace sola cada noche (solo en la nube). Sin `dia`, la lista; con
 * `dia`, descarga esa copia. Solo el encargado, como las demás copias.
 */
export async function GET(request: Request) {
  const sesion = await sesionActual();
  if (sesion?.empleado.rol !== "encargado")
    return json({ error: "Solo un encargado puede ver las copias." }, 403);
  if (!enLaNube()) return json({ noches: [] });
  try {
    if (!activa((await leerEstado(sesion.local)).ajustes, "copias"))
      return json({ error: "Las copias de seguridad están apagadas." }, 404);
    const dia = new URL(request.url).searchParams.get("dia");
    if (!dia) {
      const noches = await rpc<Noche[]>("tpv_copias", { p_local: sesion.local }).catch((e) => {
        // Sin la migración de las copias nocturnas, simplemente no hay ninguna.
        if (e instanceof Error && e.message.includes("(404)")) return [];
        throw e;
      });
      return json({ noches });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return json({ error: "Fecha no válida." }, 400);
    const copia = await rpc<{ dia: string; creada: string; datos: unknown } | null>("tpv_copia", {
      p_local: sesion.local,
      p_dia: dia,
    });
    if (!copia) return json({ error: "No hay copia de ese día." }, 404);
    const cuerpo = {
      formato: "comanda-copia-nocturna",
      local: sesion.local,
      dia: copia.dia,
      creadaEn: copia.creada,
      nota: "Carta, mesas, equipo, clientes, stock, ajustes y cuentas. Los tickets y fichajes van aparte.",
      estado: copia.datos,
    };
    return new Response(JSON.stringify(cuerpo), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="copia-noche-${sesion.local}-${dia}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}
