import { z } from "zod";
import { VERSION_PUENTE } from "@/lib/dominio/impresoras";
import { SE_IMPRIME_SOLA } from "@/lib/dominio/tipos";
import { aEscpos } from "@/lib/impresion/escpos";
import {
  apuntarPuente,
  configDirecto,
  leerEstado,
  localDePuente,
  marcarTrabajo,
} from "@/lib/servidor/almacen";
import { registrar } from "@/lib/servidor/registro";
import { json } from "@/lib/servidor/respuestas";
import { salidaDe } from "@/lib/servidor/salidas";

export const dynamic = "force-dynamic";

/**
 * El puente de impresión del bar (public/puente-impresion.mjs) pregunta aquí qué hay que
 * imprimir, cuenta cómo ha ido y, de vez en cuando, qué impresoras y puertos ve. Se identifica
 * con la clave del puente.
 */
function localDe(request: Request) {
  return localDePuente(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
}

export async function GET(request: Request) {
  const local = localDe(request);
  if (!local) return json({ error: "Clave del puente no válida." }, 401);
  // Los puentes de la primera versión solo sabían imprimir por red y no mandan esta cabecera.
  const version = request.headers.get("x-puente") ?? "1";
  const estado = await leerEstado(local);
  const trabajos = estado.trabajos.flatMap((t) => {
    if (t.estado !== "pendiente") return [];
    const impresora = estado.impresoras.find((i) => i.id === t.impresoraId);
    if (!impresora || !SE_IMPRIME_SOLA.has(impresora.conexion)) return [];
    if (version === "1" && impresora.conexion !== "red") return [];
    const salida = salidaDe(impresora);
    if (!salida) return [];
    return [
      {
        id: t.id,
        titulo: t.titulo,
        impresora: impresora.nombre,
        salida,
        // Lo que leen los puentes de la primera versión.
        ip: impresora.ip,
        puerto: impresora.puerto,
        datos: Buffer.from(aEscpos(t.documento, { columnas: impresora.columnas })).toString(
          "base64",
        ),
      },
    ];
  });
  const directo = configDirecto(local);
  return json({
    trabajos,
    version: VERSION_PUENTE,
    // Para enterarse al momento de lo nuevo en vez de preguntar sin parar.
    ...(directo.tipo === "supabase" ? { directo } : {}),
  });
}

const resultado = z.object({
  id: z.string().min(1).max(64),
  ok: z.boolean(),
  error: z.string().max(300).optional(),
});

const latido = z.object({
  latido: z.object({
    version: z.string().max(20),
    so: z.enum(["windows", "mac", "linux", "otro"]),
    sistema: z.array(z.string().max(120)).max(50),
    puertos: z.array(z.object({ ruta: z.string().max(80), nombre: z.string().max(160) })).max(50),
  }),
});

export async function POST(request: Request) {
  const local = localDe(request);
  if (!local) return json({ error: "Clave del puente no válida." }, 401);
  const cuerpo = await request.json().catch(() => null);
  const señal = latido.safeParse(cuerpo);
  if (señal.success) {
    await apuntarPuente(local, señal.data.latido);
    return json({ ok: true, version: VERSION_PUENTE });
  }
  const datos = resultado.safeParse(cuerpo);
  if (!datos.success) return json({ error: "Datos no válidos." }, 400);
  const { id, ok, error } = datos.data;
  if (!ok) registrar("aviso", "impresion_fallida", { local, via: "puente", motivo: error });
  await marcarTrabajo(
    local,
    id,
    ok ? { estado: "impreso" } : { estado: "error", error: error ?? "Error al imprimir" },
  );
  return json({ ok: true });
}
