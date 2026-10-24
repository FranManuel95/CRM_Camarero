import { almacen, leerEstado } from "@/lib/servidor/almacen";
import { flujoDeCambios, json } from "@/lib/servidor/respuestas";
import { vistaCliente } from "@/lib/servidor/vistas";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!almacen().suscribirse) return json({ error: "Usa Supabase Realtime." }, 404);
  if (!vistaCliente(await leerEstado(), token))
    return json({ error: "Este QR ya no es válido." }, 404);
  return flujoDeCambios(request, async () => vistaCliente(await leerEstado(), token));
}
