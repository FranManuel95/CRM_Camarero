import { cookies } from "next/headers";
import { z } from "zod";
import { entrarConPin } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import {
  COOKIE_SESION,
  crearFirmado,
  DURACION,
  localDelAparato,
  opcionesCookie,
  sesionActual,
} from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

// Un PIN de 4 cifras se adivina probando: se corta tras 8 intentos fallidos en 5 minutos.
const limite = crearLimite(8, 5 * 60_000);

export async function GET() {
  const sesion = await sesionActual();
  return json({
    empleado: sesion
      ? { id: sesion.empleado.id, nombre: sesion.empleado.nombre, rol: sesion.empleado.rol }
      : null,
  });
}

export async function POST(request: Request) {
  const datos = z
    .object({ pin: z.string().max(6) })
    .safeParse(await request.json().catch(() => null));
  if (!datos.success) return json({ error: "Escribe tu PIN." }, 400);
  const local = await localDelAparato();
  if (!local) return json({ error: "Este aparato aún no está vinculado a ningún bar." }, 409);
  try {
    const empleado = await entrarConPin(local, datos.data.pin);
    if (!empleado) {
      if (!limite(`${ipDe(request)}|${local}`))
        return json({ error: "Demasiados intentos. Espera unos minutos." }, 429);
      return json({ error: "Ese PIN no es de nadie del equipo." }, 401);
    }
    (await cookies()).set(
      COOKIE_SESION,
      crearFirmado([local, empleado.id], DURACION.sesion),
      opcionesCookie(request, DURACION.sesion),
    );
    return json({ empleado: { id: empleado.id, nombre: empleado.nombre, rol: empleado.rol } });
  } catch (e) {
    return respuestaDeError(e);
  }
}

export async function DELETE() {
  (await cookies()).delete(COOKIE_SESION);
  return json({ ok: true });
}
