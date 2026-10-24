import { leerEstado } from "@/lib/servidor/almacen";
import { json } from "@/lib/servidor/respuestas";
import { empleadoActual } from "@/lib/servidor/sesion";
import { vistaPersonal } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await empleadoActual())) return json({ error: "Entra con tu PIN." }, 401);
  return json(vistaPersonal(await leerEstado()));
}
