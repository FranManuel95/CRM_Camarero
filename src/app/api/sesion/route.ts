import { cookies } from "next/headers";
import { z } from "zod";
import { entrarConPin } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { json } from "@/lib/servidor/respuestas";
import {
  COOKIE_SESION,
  crearValorSesion,
  empleadoActual,
  opcionesCookie,
} from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

// Un PIN de 4 cifras se adivina probando: se corta tras 8 intentos fallidos en 5 minutos.
const limite = crearLimite(8, 5 * 60_000);

export async function GET() {
  const empleado = await empleadoActual();
  return json({
    empleado: empleado ? { id: empleado.id, nombre: empleado.nombre, rol: empleado.rol } : null,
  });
}

export async function POST(request: Request) {
  const datos = z
    .object({ pin: z.string().max(6) })
    .safeParse(await request.json().catch(() => null));
  if (!datos.success) return json({ error: "Escribe tu PIN." }, 400);
  const empleado = await entrarConPin(datos.data.pin);
  if (!empleado) {
    if (!limite(ipDe(request)))
      return json({ error: "Demasiados intentos. Espera unos minutos." }, 429);
    return json({ error: "Ese PIN no es de nadie del equipo." }, 401);
  }
  (await cookies()).set(COOKIE_SESION, crearValorSesion(empleado.id), opcionesCookie(request));
  return json({ empleado: { id: empleado.id, nombre: empleado.nombre, rol: empleado.rol } });
}

export async function DELETE() {
  (await cookies()).delete(COOKIE_SESION);
  return json({ ok: true });
}
