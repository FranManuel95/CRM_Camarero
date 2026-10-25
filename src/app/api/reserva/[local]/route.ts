import { reservaOnline } from "@/lib/dominio/acciones";
import { ejecutarReservaOnline } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";

export const dynamic = "force-dynamic";

const porIp = crearLimite(5, 10 * 60_000);

/** Pide mesa desde la web del bar (queda por confirmar). */
export async function POST(request: Request, { params }: { params: Promise<{ local: string }> }) {
  const { local } = await params;
  if (!porIp(`${local}/${ipDe(request)}`))
    return json({ error: "Vas muy rápido. Espera un poco y vuelve a probar." }, 429);
  try {
    await ejecutarReservaOnline(local, reservaOnline.parse(await request.json()));
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
