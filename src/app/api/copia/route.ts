import { crearCopia, leerCopia } from "@/lib/dominio/copia";
import { activa } from "@/lib/dominio/funciones";
import { almacen, leerEstado } from "@/lib/servidor/almacen";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Las copias tienen datos del equipo: solo el encargado, y solo con la función encendida. */
async function permiso() {
  const sesion = await sesionActual();
  if (sesion?.empleado.rol !== "encargado")
    return { error: json({ error: "Solo un encargado puede hacer copias." }, 403) };
  if (!activa((await leerEstado(sesion.local)).ajustes, "copias"))
    return { error: json({ error: "Las copias de seguridad están apagadas." }, 404) };
  return { local: sesion.local };
}

/** Descarga una copia completa del bar (todos los tickets y fichajes). */
export async function GET() {
  const p = await permiso();
  if ("error" in p) return p.error;
  try {
    const ahora = new Date().toISOString();
    const copia = crearCopia(await almacen(p.local).completo(), p.local, ahora);
    return new Response(JSON.stringify(copia), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="copia-${p.local}-${ahora.slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}

/**
 * Vuelve a una copia. Solo en el ordenador del bar: en la nube los tickets son definitivos y no
 * se pueden sustituir.
 */
export async function POST(request: Request) {
  const p = await permiso();
  if ("error" in p) return p.error;
  const a = almacen(p.local);
  if (!a.restaurar)
    return json(
      { error: "En la nube no se puede volver a una copia: los tickets ya son definitivos." },
      409,
    );
  try {
    const copia = leerCopia(await request.text());
    await a.restaurar(copia.estado);
    return json({ ok: true, tickets: copia.estado.tickets.length });
  } catch (e) {
    return respuestaDeError(e);
  }
}
