import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { aEscpos } from "@/lib/impresion/escpos";
import { clavePuente, leerEstado, marcarTrabajo } from "@/lib/servidor/almacen";
import { json } from "@/lib/servidor/respuestas";

export const dynamic = "force-dynamic";

/**
 * El puente de impresión del bar (public/puente-impresion.mjs) pregunta aquí qué hay que imprimir
 * en las impresoras de red y luego cuenta cómo ha ido. Se identifica con la clave del puente.
 */
function autorizado(request: Request) {
  const recibida = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const esperada = Buffer.from(clavePuente());
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

export async function GET(request: Request) {
  if (!autorizado(request)) return json({ error: "Clave del puente no válida." }, 401);
  const estado = await leerEstado();
  const trabajos = estado.trabajos.flatMap((t) => {
    const impresora = estado.impresoras.find((i) => i.id === t.impresoraId);
    if (t.estado !== "pendiente" || impresora?.conexion !== "red") return [];
    return [
      {
        id: t.id,
        titulo: t.titulo,
        impresora: impresora.nombre,
        ip: impresora.ip,
        puerto: impresora.puerto,
        datos: Buffer.from(aEscpos(t.documento, { columnas: impresora.columnas })).toString(
          "base64",
        ),
      },
    ];
  });
  return json({ trabajos });
}

const resultado = z.object({
  id: z.string().min(1).max(64),
  ok: z.boolean(),
  error: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  if (!autorizado(request)) return json({ error: "Clave del puente no válida." }, 401);
  const datos = resultado.safeParse(await request.json().catch(() => null));
  if (!datos.success) return json({ error: "Datos no válidos." }, 400);
  const { id, ok, error } = datos.data;
  await marcarTrabajo(
    id,
    ok ? { estado: "impreso" } : { estado: "error", error: error ?? "Error al imprimir" },
  );
  return json({ ok: true });
}
