import { reiniciarDemo } from "@/lib/servidor/almacen";
import { json } from "@/lib/servidor/respuestas";
import { empleadoActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

/** Vuelve a los datos de ejemplo. Se desactiva con DEMO=false en un local de verdad. */
export async function POST() {
  if (process.env.DEMO === "false") return json({ error: "No disponible." }, 404);
  const empleado = await empleadoActual();
  if (empleado?.rol !== "encargado") return json({ error: "Solo un encargado." }, 403);
  reiniciarDemo();
  return json({ ok: true });
}
