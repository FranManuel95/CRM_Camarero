import { VERSION_PUENTE } from "@/lib/dominio/impresoras";
import { enLaNube, leerEstado } from "@/lib/servidor/almacen";
import { json } from "@/lib/servidor/respuestas";
import { equipoLocal } from "@/lib/servidor/salidas";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

/**
 * Las impresoras y puertos que hay en el ordenador que imprime, para elegir de una lista al dar
 * de alta una impresora. En el bar, el propio servidor los mira ahora; en la nube, es lo último
 * que ha contado el puente.
 */
export async function GET() {
  const sesion = await sesionActual();
  if (sesion?.empleado.rol !== "encargado")
    return json({ error: "Esto solo lo puede ver un encargado." }, 403);
  if (enLaNube()) return json({ equipo: (await leerEstado(sesion.local)).puente ?? null });
  const equipo = await equipoLocal();
  return json({
    equipo: { ...equipo, visto: new Date().toISOString(), version: VERSION_PUENTE },
    // En el bar no hace falta puente: imprime el propio servidor.
    servidorLocal: true,
  });
}
