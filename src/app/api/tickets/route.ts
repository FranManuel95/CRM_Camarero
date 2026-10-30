import { z } from "zod";
import { almacen } from "@/lib/servidor/almacen";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

/** Como mucho, algo más de un año por petición. */
const MAX_DIAS = 400;

/**
 * Tickets de un periodo, para informes y búsquedas. No van con los datos en directo (pesarían
 * demasiado) y solo los pide el encargado. Los tickets no cambian nunca: se pueden guardar.
 */
export async function GET(request: Request) {
  const sesion = await sesionActual();
  if (!sesion) return json({ error: "Entra con tu PIN." }, 401);
  if (sesion.empleado.rol !== "encargado")
    return json({ error: "Esto solo lo puede ver un encargado." }, 403);
  try {
    const url = new URL(request.url);
    const { desde, hasta } = z
      .object({ desde: z.iso.datetime(), hasta: z.iso.datetime() })
      .parse({ desde: url.searchParams.get("desde"), hasta: url.searchParams.get("hasta") });
    if (hasta <= desde || Date.parse(hasta) - Date.parse(desde) > MAX_DIAS * 86_400_000)
      return json({ error: "Ese periodo no vale." }, 400);
    const tickets = await almacen(sesion.local).ticketsEntre(desde, hasta);
    return Response.json(
      { tickets },
      // Los de días ya pasados no cambian: el navegador los puede guardar un rato.
      {
        headers: {
          "Cache-Control": hasta < new Date().toISOString() ? "private, max-age=300" : "no-store",
        },
      },
    );
  } catch (e) {
    return respuestaDeError(e);
  }
}
