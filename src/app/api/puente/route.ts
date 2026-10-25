import { z } from "zod";
import { aEscpos } from "@/lib/impresion/escpos";
import { leerEstado, localDePuente, marcarTrabajo } from "@/lib/servidor/almacen";
import { json } from "@/lib/servidor/respuestas";

export const dynamic = "force-dynamic";

/**
 * El puente de impresión del bar (public/puente-impresion.mjs) pregunta aquí qué hay que imprimir
 * en las impresoras de red y luego cuenta cómo ha ido. Se identifica con la clave del puente.
 */
/** El bar al que pertenece la clave del puente, o null si no vale. */
function localDe(request: Request) {
  return localDePuente(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
}

export async function GET(request: Request) {
  const local = localDe(request);
  if (!local) return json({ error: "Clave del puente no válida." }, 401);
  const estado = await leerEstado(local);
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
  const local = localDe(request);
  if (!local) return json({ error: "Clave del puente no válida." }, 401);
  const datos = resultado.safeParse(await request.json().catch(() => null));
  if (!datos.success) return json({ error: "Datos no válidos." }, 400);
  const { id, ok, error } = datos.data;
  await marcarTrabajo(
    local,
    id,
    ok ? { estado: "impreso" } : { estado: "error", error: error ?? "Error al imprimir" },
  );
  return json({ ok: true });
}
