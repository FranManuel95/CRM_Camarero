import { cookies } from "next/headers";
import { z } from "zod";
import { enLaNube, gastarCodigoVinculo, localDemo } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { localesDe } from "@/lib/servidor/nube";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import {
  COOKIE_APARATO,
  COOKIE_SESION,
  crearFirmado,
  DURACION,
  duenoActual,
  opcionesCookie,
} from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

const peticion = z.discriminatedUnion("modo", [
  z.object({ modo: z.literal("demo") }),
  z.object({ modo: z.literal("dueno"), local: z.string().regex(/^[a-z0-9-]{3,40}$/) }),
  z.object({
    modo: z.literal("codigo"),
    local: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{3,40}$/, "Revisa el nombre del bar."),
    codigo: z.string().regex(/^\d{6}$/, "El código son 6 cifras."),
  }),
]);

// Un código de 6 cifras también se puede adivinar probando.
const limite = crearLimite(10, 10 * 60_000);

/** Vincula este aparato (móvil, tablet, ordenador) a un bar. */
export async function POST(request: Request) {
  if (!enLaNube()) return json({ error: "En el ordenador del bar no hace falta vincular." }, 404);
  try {
    const datos = peticion.parse(await request.json());
    let local: string;
    if (datos.modo === "demo") local = localDemo();
    else if (datos.modo === "dueno") {
      const dueno = await duenoActual();
      if (!dueno) return json({ error: "Entra con tu cuenta de dueño." }, 401);
      if (!(await localesDe(dueno)).some((l) => l.id === datos.local))
        return json({ error: "Ese bar no es tuyo." }, 403);
      local = datos.local;
    } else {
      if (!limite(ipDe(request)))
        return json({ error: "Demasiados intentos. Espera unos minutos." }, 429);
      await gastarCodigoVinculo(datos.local, datos.codigo);
      local = datos.local;
    }
    const almacen = await cookies();
    almacen.delete(COOKIE_SESION);
    almacen.set(
      COOKIE_APARATO,
      crearFirmado([local], DURACION.aparato),
      opcionesCookie(request, DURACION.aparato),
    );
    return json({ ok: true, local });
  } catch (e) {
    return respuestaDeError(e);
  }
}

/** Desvincula el aparato (para usarlo en otro bar). */
export async function DELETE() {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
  almacen.delete(COOKIE_APARATO);
  return json({ ok: true });
}
