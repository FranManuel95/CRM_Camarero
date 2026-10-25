import { cookies } from "next/headers";
import { z } from "zod";
import { enLaNube } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { acceder, pedirCambioDeClave, registrar } from "@/lib/servidor/nube";
import { json } from "@/lib/servidor/respuestas";
import { COOKIE_DUENO, crearFirmado, DURACION, opcionesCookie } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

const correo = z.email("Ese correo no parece bien escrito.").max(200);
const peticion = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("registro"),
    email: correo,
    clave: z.string().min(8, "La contraseña necesita al menos 8 caracteres.").max(72),
  }),
  z.object({ accion: z.literal("acceder"), email: correo, clave: z.string().min(1).max(72) }),
  z.object({ accion: z.literal("recuperar"), email: correo }),
  z.object({ accion: z.literal("salir") }),
]);

const limite = crearLimite(10, 10 * 60_000);

/** Cuenta del dueño: alta, entrada, contraseña olvidada y salida. */
export async function POST(request: Request) {
  if (!enLaNube())
    return json({ error: "Las cuentas solo existen en la versión en internet." }, 404);
  const datos = peticion.safeParse(await request.json().catch(() => null));
  if (!datos.success)
    return json({ error: datos.error.issues[0]?.message ?? "Datos no válidos." }, 400);
  const p = datos.data;
  const galletas = await cookies();
  if (p.accion === "salir") {
    galletas.delete(COOKIE_DUENO);
    return json({ ok: true });
  }
  if (!limite(ipDe(request)))
    return json({ error: "Demasiados intentos. Espera unos minutos." }, 429);
  const origen = new URL(request.url).origin;

  if (p.accion === "recuperar") {
    await pedirCambioDeClave(p.email, `${origen}/acceder/nueva-clave`);
    return json({ ok: true });
  }
  if (p.accion === "registro") {
    const r = await registrar(p.email, p.clave, `${origen}/acceder?confirmado=1`);
    if (r.error) return json({ error: r.error }, 400);
    if (!r.usuario) return json({ ok: true, confirmar: true });
    galletas.set(
      COOKIE_DUENO,
      crearFirmado([r.usuario.id, r.usuario.email], DURACION.dueno),
      opcionesCookie(request, DURACION.dueno),
    );
    return json({ ok: true });
  }
  const r = await acceder(p.email, p.clave);
  if (!r.dueno) return json({ error: r.error }, 401);
  galletas.set(
    COOKIE_DUENO,
    crearFirmado([r.dueno.id, r.dueno.email], DURACION.dueno),
    opcionesCookie(request, DURACION.dueno),
  );
  return json({ ok: true });
}
