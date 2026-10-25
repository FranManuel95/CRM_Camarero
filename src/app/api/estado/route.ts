import { leerEstado } from "@/lib/servidor/almacen";
import { json } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";
import { vistaPersonal } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return json({ error: "Entra con tu PIN." }, 401);
  return json(vistaPersonal(await leerEstado(sesion.local), sesion.local, sesion.empleado));
}
