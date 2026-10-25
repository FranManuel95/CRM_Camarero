import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { enLaNube } from "@/lib/servidor/almacen";
import { json, respuestaDeError } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";
import { rpc } from "@/lib/servidor/supabase-rpc";

export const dynamic = "force-dynamic";

const MAXIMO = 2 * 1024 * 1024;

/**
 * Fotos de los platos (solo el encargado).
 * - En la nube: da permiso para subir una ruta y devuelve a dónde subirla (la sube el navegador
 *   directamente a Supabase Storage).
 * - En el ordenador del bar: recibe la foto y la guarda junto a los datos.
 */
export async function POST(request: Request) {
  const sesion = await sesionActual();
  if (sesion?.empleado.rol !== "encargado")
    return json({ error: "Solo un encargado puede subir fotos." }, 403);
  const nombre = `${randomUUID()}.webp`;
  try {
    if (enLaNube()) {
      const ruta = `${sesion.local}/${nombre}`;
      await rpc("tpv_permitir_subida", { p_ruta: ruta });
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      return json({
        subir: `${base}/storage/v1/object/fotos/${ruta}`,
        publica: `${base}/storage/v1/object/public/fotos/${ruta}`,
      });
    }
    const datos = Buffer.from(await request.arrayBuffer());
    if (!datos.length) return json({ subir: "/api/fotos", publica: null });
    if (datos.length > MAXIMO) return json({ error: "La foto es demasiado grande." }, 413);
    const carpeta = path.join(process.env.DATOS_DIR ?? path.join(process.cwd(), "datos"), "fotos");
    await mkdir(carpeta, { recursive: true });
    await writeFile(path.join(carpeta, nombre), datos);
    return json({ publica: `/api/fotos/${nombre}` });
  } catch (e) {
    return respuestaDeError(e);
  }
}
