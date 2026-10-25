import { encargoOnline } from "@/lib/dominio/acciones";
import { ejecutarEncargoOnline } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";

export const dynamic = "force-dynamic";

// Para que nadie llene la sala de encargos de broma.
const porIp = crearLimite(5, 10 * 60_000);

/** Empieza un encargo para llevar desde la web del bar; devuelve el enlace para pedir. */
export async function POST(request: Request, { params }: { params: Promise<{ local: string }> }) {
  const { local } = await params;
  if (!porIp(`${local}/${ipDe(request)}`))
    return json({ error: "Vas muy rápido. Espera un poco y vuelve a probar." }, 429);
  try {
    const token = await ejecutarEncargoOnline(local, encargoOnline.parse(await request.json()));
    return json({ ok: true, enlace: `/m/${local}/${token}` });
  } catch (e) {
    return respuestaDeError(e);
  }
}
