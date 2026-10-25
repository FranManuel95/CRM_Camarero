import { aCsv } from "@/lib/csv";
import { filasRegistro } from "@/lib/dominio/equipo";
import { inicioDelDia, sumarDias } from "@/lib/dominio/informes";
import { almacen, leerEstado } from "@/lib/servidor/almacen";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Registro de jornada de un periodo en CSV (el completo, no solo lo que se ve en pantalla). Es lo
 * que se enseña a la Inspección de Trabajo o se manda a la gestoría.
 */
export async function GET(request: Request) {
  const sesion = await sesionActual();
  if (sesion?.empleado.rol !== "encargado")
    return json({ error: "Solo un encargado puede descargar el registro." }, 403);
  const url = new URL(request.url);
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";
  if (!DIA.test(desde) || !DIA.test(hasta) || hasta < desde)
    return json({ error: "Elige bien las fechas." }, 400);
  try {
    const [estado, fichajes] = await Promise.all([
      leerEstado(sesion.local),
      almacen(sesion.local).fichajesEntre(inicioDelDia(desde), inicioDelDia(sumarDias(hasta, 1))),
    ]);
    const csv = aCsv(filasRegistro(fichajes, estado.empleados, new Date().toISOString()));
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registro-jornada_${desde}_${hasta}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}
