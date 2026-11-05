import { rangoDeDias, sumarDias } from "@/lib/dominio/informes";
import { diaLocal } from "@/lib/fechas";
import { almacen, enLaNube, LOCAL_ARCHIVO, leerEstado } from "@/lib/servidor/almacen";
import { mandarResumen } from "@/lib/servidor/correo";
import { listarLocales } from "@/lib/servidor/nube";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { servicios } from "@/lib/servidor/servicios";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

const ayer = () => sumarDias(diaLocal(new Date().toISOString()), -1);

/**
 * El bar con los tickets que hacen falta para el resumen de un día: ese día y el mismo de la
 * semana anterior (con el bar solo vienen los de las últimas horas).
 */
async function conTicketsDe(local: string, dia: string) {
  const estado = await leerEstado(local);
  const { desde } = rangoDeDias(sumarDias(dia, -7), dia);
  const { hasta } = rangoDeDias(dia, dia);
  return { ...estado, tickets: await almacen(local).ticketsEntre(desde, hasta) };
}

/**
 * Cada mañana (cron de Vercel, con CRON_SECRET): manda a cada bar que lo tenga encendido el
 * resumen del día anterior. Sin CRON_SECRET no hace nada, para que nadie lo dispare desde fuera.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`)
    return json({ error: "No autorizado." }, 401);
  if (!servicios().correo) return json({ mandados: 0, motivo: "Sin servicio de correo." });
  const locales = enLaNube()
    ? (await listarLocales()).filter((l) => !l.esDemo).map((l) => l.id)
    : [LOCAL_ARCHIVO];
  let mandados = 0;
  const fallos: string[] = [];
  for (const local of locales) {
    try {
      const r = (await leerEstado(local)).ajustes.resumenDiario;
      if (!r?.activo || !r.correo) continue;
      await mandarResumen(await conTicketsDe(local, ayer()), ayer(), r.correo);
      mandados++;
    } catch (e) {
      console.error(`Resumen diario de ${local}:`, e);
      fallos.push(local);
    }
  }
  return json({ mandados, fallos });
}

/** «Mandármelo ahora»: el encargado prueba el resumen de ayer en su correo. */
export async function POST() {
  const sesion = await sesionActual();
  if (!sesion) return json({ error: "Tu sesión ha caducado. Vuelve a entrar con tu PIN." }, 401);
  if (sesion.empleado.rol !== "encargado")
    return json({ error: "Esto solo lo puede hacer un encargado." }, 403);
  try {
    if (!servicios().correo)
      return json({ error: "Falta configurar el servicio de correo en el servidor." }, 400);
    const correo = (await leerEstado(sesion.local)).ajustes.resumenDiario?.correo;
    if (!correo) return json({ error: "Guarda primero el correo." }, 400);
    await mandarResumen(await conTicketsDe(sesion.local, ayer()), ayer(), correo);
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
