import { z } from "zod";
import { disponible } from "@/lib/dominio/funciones";
import { leerEstado } from "@/lib/servidor/almacen";
import { mandarTicket } from "@/lib/servidor/correo";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { servicios } from "@/lib/servidor/servicios";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

/** Desde la caja: manda un ticket al correo que dé el cliente (no se guarda). */
export async function POST(request: Request) {
  const sesion = await sesionActual();
  if (!sesion) return json({ error: "Tu sesión ha caducado. Vuelve a entrar con tu PIN." }, 401);
  try {
    const { ticketId, correo } = z
      .object({
        ticketId: z.string().min(1).max(64),
        correo: z.email("Ese correo no parece bien escrito.").max(200),
      })
      .parse(await request.json());
    const estado = await leerEstado(sesion.local);
    if (!disponible(estado.ajustes, servicios(), "ticketCorreo"))
      return json({ error: "El ticket por correo está apagado." }, 400);
    const ticket = estado.tickets.find((t) => t.id === ticketId);
    if (!ticket) return json({ error: "No encuentro ese ticket." }, 404);
    await mandarTicket(estado, ticket, correo);
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
