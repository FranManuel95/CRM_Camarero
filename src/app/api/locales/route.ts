import { z } from "zod";
import { crearLocal } from "@/lib/servidor/nube";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { duenoActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

const barNuevo = z.object({
  nombre: z.string().trim().min(2, "Pon el nombre del bar.").max(60),
  encargado: z.string().trim().min(1, "Pon tu nombre.").max(40),
  pin: z.string().regex(/^\d{4,6}$/, "El PIN son de 4 a 6 cifras."),
  conCartaDeEjemplo: z.boolean(),
});

/** Da de alta un bar para el dueño que ha entrado. */
export async function POST(request: Request) {
  const dueno = await duenoActual();
  if (!dueno) return json({ error: "Entra con tu cuenta de dueño." }, 401);
  try {
    const id = await crearLocal(dueno, barNuevo.parse(await request.json()));
    return json({ ok: true, id });
  } catch (e) {
    return respuestaDeError(e);
  }
}
