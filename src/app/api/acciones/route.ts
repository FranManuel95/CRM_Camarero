import { z } from "zod";
import { accionPersonal } from "@/lib/dominio/acciones";
import { ejecutarPersonal } from "@/lib/servidor/almacen";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sesion = await sesionActual();
  if (!sesion) return json({ error: "Tu sesión ha caducado. Vuelve a entrar con tu PIN." }, 401);
  try {
    const { accion } = z.object({ accion: accionPersonal }).parse(await request.json());
    return json({
      ok: true,
      trabajos: await ejecutarPersonal(sesion.local, accion, sesion.empleado),
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}
