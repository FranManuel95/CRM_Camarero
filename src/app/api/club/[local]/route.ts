import { altaClub } from "@/lib/dominio/acciones";
import { ejecutarAltaClub } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";

export const dynamic = "force-dynamic";

const porIp = crearLimite(5, 10 * 60_000);

/** Alta en el club desde el móvil del cliente. Devuelve el enlace de su tarjeta. */
export async function POST(request: Request, { params }: { params: Promise<{ local: string }> }) {
  const { local } = await params;
  if (!porIp(`${local}/${ipDe(request)}`))
    return json({ error: "Vas muy rápido. Espera un poco y vuelve a probar." }, 429);
  try {
    const codigo = await ejecutarAltaClub(local, altaClub.parse(await request.json()));
    return json({ ok: true, codigo, tarjeta: `/m/${local}/club/${codigo}` });
  } catch (e) {
    return respuestaDeError(e);
  }
}
