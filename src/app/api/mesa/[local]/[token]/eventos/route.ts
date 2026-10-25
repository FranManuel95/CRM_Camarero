import { almacen, leerEstado } from "@/lib/servidor/almacen";
import { flujoDeCambios, json } from "@/lib/servidor/respuestas";
import { vistaCliente } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ local: string; token: string }> };

export async function GET(request: Request, { params }: Params) {
  const { local, token } = await params;
  if (!almacen(local).suscribirse) return json({ error: "Usa Supabase Realtime." }, 404);
  if (!vistaCliente(await leerEstado(local), token))
    return json({ error: "Este QR ya no es válido." }, 404);
  return flujoDeCambios(request, local, async () => vistaCliente(await leerEstado(local), token));
}
