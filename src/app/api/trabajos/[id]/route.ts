import { aEscpos } from "@/lib/impresion/escpos";
import { leerEstado, marcarImpreso } from "@/lib/servidor/almacen";
import { json } from "@/lib/servidor/respuestas";
import { empleadoActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Los bytes ESC/POS de un trabajo, para imprimir por USB o Bluetooth desde el navegador. */
export async function GET(request: Request, { params }: Params) {
  if (!(await empleadoActual())) return json({ error: "Entra con tu PIN." }, 401);
  const { id } = await params;
  const estado = leerEstado();
  const trabajo = estado.trabajos.find((t) => t.id === id);
  if (!trabajo) return json({ error: "Ese trabajo ya no está en la cola." }, 404);
  const columnas = Number(new URL(request.url).searchParams.get("columnas")) || 48;
  return new Response(Buffer.from(aEscpos(trabajo.documento, { columnas })), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}

/** La pantalla avisa de que lo ha impreso ella (navegador, USB o Bluetooth). */
export async function POST(_request: Request, { params }: Params) {
  if (!(await empleadoActual())) return json({ error: "Entra con tu PIN." }, 401);
  marcarImpreso((await params).id);
  return json({ ok: true });
}
