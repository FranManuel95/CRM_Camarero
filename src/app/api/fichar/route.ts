import { z } from "zod";
import { fichaPersonal } from "@/lib/dominio/equipo";
import { ejecutarPersonal, entrarConPin, leerEstado } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { localDelAparato } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

// Igual que al entrar: un PIN se adivina probando, así que se corta tras 8 fallos en 5 minutos.
const limite = crearLimite(8, 5 * 60_000);

/**
 * Fichar con el PIN en el aparato del bar, sin abrir sesión. Sin `que`, solo dice cómo está la
 * persona (para enseñarle los botones que tocan); con `que`, ficha.
 */
export async function POST(request: Request) {
  const datos = z
    .object({
      pin: z.string().max(6),
      que: z.enum(["entrada", "pausa", "vuelta", "salida"]).optional(),
    })
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
    if (datos.data.que)
      await ejecutarPersonal(local, { tipo: "fichar", que: datos.data.que }, empleado);
    const estado = await leerEstado(local);
    return json({
      nombre: empleado.nombre,
      ...fichaPersonal(estado, empleado.id, new Date().toISOString()),
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}
