import { almacen } from "@/lib/servidor/almacen";
import { json } from "@/lib/servidor/respuestas";
import { empleadoActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

/** Vuelve a los datos de ejemplo. Solo en el ordenador del bar: en la nube los tickets no se borran. */
export async function POST() {
  if (process.env.DEMO === "false") return json({ error: "No disponible." }, 404);
  const empleado = await empleadoActual();
  if (empleado?.rol !== "encargado") return json({ error: "Solo un encargado." }, 403);
  const { reiniciar } = almacen();
  if (!reiniciar)
    return json({ error: "En la nube los tickets son definitivos: no se pueden borrar." }, 409);
  await reiniciar();
  return json({ ok: true });
}
