import { z } from "zod";
import { aEscpos } from "@/lib/impresion/escpos";
import { leerEstado, marcarTrabajo } from "@/lib/servidor/almacen";
import { registrar } from "@/lib/servidor/registro";
import { json } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Los bytes ESC/POS de un trabajo, para imprimir por USB, Bluetooth o puerto desde la pantalla. */
export async function GET(request: Request, { params }: Params) {
  const sesion = await sesionActual();
  if (!sesion) return json({ error: "Entra con tu PIN." }, 401);
  const { id } = await params;
  const estado = await leerEstado(sesion.local);
  const trabajo = estado.trabajos.find((t) => t.id === id);
  if (!trabajo) return json({ error: "Ese trabajo ya no está en la cola." }, 404);
  // El ancho del papel es el de su impresora; si no tiene, el que diga la pantalla.
  const impresora = estado.impresoras.find((i) => i.id === trabajo.impresoraId);
  const columnas =
    impresora?.columnas ?? (Number(new URL(request.url).searchParams.get("columnas")) || 48);
  return new Response(Buffer.from(aEscpos(trabajo.documento, { columnas })), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}

const resultado = z
  .object({ ok: z.boolean(), error: z.string().max(300).optional() })
  .catch({ ok: true });

/** La pantalla cuenta cómo ha ido (diálogo, USB, Bluetooth o puerto). Sin cuerpo: impreso. */
export async function POST(request: Request, { params }: Params) {
  const sesion = await sesionActual();
  if (!sesion) return json({ error: "Entra con tu PIN." }, 401);
  const { ok, error } = resultado.parse(await request.json().catch(() => ({ ok: true })));
  if (!ok)
    registrar("aviso", "impresion_fallida", {
      local: sesion.local,
      via: "pantalla",
      motivo: error,
    });
  await marcarTrabajo(
    sesion.local,
    (await params).id,
    ok ? { estado: "impreso" } : { estado: "error", error: error ?? "Error al imprimir" },
  );
  return json({ ok: true });
}
