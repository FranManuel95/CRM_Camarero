import { accionCliente } from "@/lib/dominio/acciones";
import { ejecutarCliente, leerEstado } from "@/lib/servidor/almacen";
import { crearLimite, ipDe } from "@/lib/servidor/limite";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { vistaCliente } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

// Para que nadie llene la cocina de pedidos de broma: 12 acciones por minuto y mesa.
const porMesa = crearLimite(12, 60_000);
const porIp = crearLimite(30, 60_000);

export async function GET(_request: Request, { params }: Params) {
  const vista = vistaCliente(leerEstado(), (await params).token);
  return vista ? json(vista) : json({ error: "Este QR ya no es válido." }, 404);
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  if (!porMesa(token) || !porIp(ipDe(request)))
    return json({ error: "Vas muy rápido. Espera un momento y vuelve a probar." }, 429);
  try {
    ejecutarCliente(token, accionCliente.parse(await request.json()));
    return json({ ok: true });
  } catch (e) {
    return respuestaDeError(e);
  }
}
