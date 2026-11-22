import { z } from "zod";
import { altaDeBar, ErrorAlta } from "@/lib/servidor/nube";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { duenoActual, esAdmin } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

const barNuevo = z.object({
  correo: z.email("Revisa el correo del dueño.").max(200),
  clave: z.string().min(8, "La contraseña provisional necesita al menos 8 caracteres.").max(72),
  nombre: z.string().trim().min(2, "Pon el nombre del bar.").max(60),
  encargado: z.string().trim().min(1, "Pon el nombre del encargado.").max(40),
  pin: z.string().regex(/^\d{4,6}$/, "El PIN son de 4 a 6 cifras."),
  conCartaDeEjemplo: z.boolean(),
});

/**
 * Alta de un bar. Solo la hace quien vende Comanda (ADMIN_EMAILS), para la cuenta del dueño:
 * se la crea con una contraseña provisional, o le añade el bar si ya tiene cuenta.
 */
export async function POST(request: Request) {
  const dueno = await duenoActual();
  if (!dueno) return json({ error: "Entra con tu cuenta." }, 401);
  if (!esAdmin(dueno))
    return json(
      { error: "Los bares nuevos los da de alta Comanda. Pídenoslo y te lo montamos." },
      403,
    );
  try {
    const datos = barNuevo.parse(await request.json());
    const origen = new URL(request.url).origin;
    const r = await altaDeBar(datos, `${origen}/acceder?confirmado=1`);
    return json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof ErrorAlta) return json({ error: e.message }, 400);
    return respuestaDeError(e);
  }
}
