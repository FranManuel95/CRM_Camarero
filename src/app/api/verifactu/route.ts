import { z } from "zod";
import { reintentar } from "@/lib/dominio/verifactu";
import { almacen } from "@/lib/servidor/almacen";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";
import { enviarVerifactu } from "@/lib/servidor/verifactu";

export const dynamic = "force-dynamic";

/**
 * El encargado manda ya lo pendiente a la AEAT (o vuelve a poner en cola uno rechazado, por
 * ejemplo después de corregir el NIF del bar).
 */
export async function POST(request: Request) {
  const sesion = await sesionActual();
  if (sesion?.empleado.rol !== "encargado")
    return json({ error: "Solo un encargado puede mandar los registros." }, 403);
  try {
    const { reintentar: ticketId } = z
      .object({ reintentar: z.string().min(1).max(64).optional() })
      .parse(await request.json().catch(() => ({})));
    if (ticketId)
      await almacen(sesion.local).cambiar((estado) => ({
        estado: reintentar(estado, ticketId),
        trabajos: [],
      }));
    await enviarVerifactu(sesion.local);
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
