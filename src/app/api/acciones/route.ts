import { after } from "next/server";
import { z } from "zod";
import { accionPersonal } from "@/lib/dominio/acciones";
import { ejecutarPersonal } from "@/lib/servidor/almacen";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";
import { vistaPersonal } from "@/lib/servidor/vistas";
import { enviarVerifactu } from "@/lib/servidor/verifactu";

/** Las acciones que hacen tickets: después, se mandan a la AEAT si VERI*FACTU está encendido. */
const HACEN_TICKET = new Set(["cobrar", "venta_rapida", "rectificar_ticket"]);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sesion = await sesionActual();
  if (!sesion) return json({ error: "Tu sesión ha caducado. Vuelve a entrar con tu PIN." }, 401);
  try {
    const { accion } = z.object({ accion: accionPersonal }).parse(await request.json());
    const { trabajos, estado } = await ejecutarPersonal(sesion.local, accion, sesion.empleado);
    if (HACEN_TICKET.has(accion.tipo)) after(() => enviarVerifactu(sesion.local));
    // Con la vista nueva en la respuesta, quien ha hecho el cambio no tiene que volver a pedirla.
    const vista = estado ? vistaPersonal(estado, sesion.local, sesion.empleado) : undefined;
    return json({ ok: true, trabajos, vista });
  } catch (e) {
    return respuestaDeError(e);
  }
}
