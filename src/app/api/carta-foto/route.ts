import { CartaIlegible, leerCarta, TIPOS_CARTA, type TipoCarta } from "@/lib/servidor/carta-foto";
import { hayIa, IaSaturada } from "@/lib/servidor/ia";
import { json } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Recibe la foto o el PDF de la carta (el cuerpo es el archivo) y devuelve lo leído para que el
 * encargado lo revise antes de darlo de alta. No guarda nada.
 */
export async function POST(request: Request) {
  const sesion = await sesionActual();
  if (sesion?.empleado.rol !== "encargado")
    return json({ error: "Solo un encargado puede cambiar la carta." }, 403);
  if (!hayIa())
    return json({ error: "La lectura de cartas no está activada en este servidor." }, 404);
  const tipo = request.headers.get("content-type") ?? "";
  if (!TIPOS_CARTA.includes(tipo as TipoCarta))
    return json({ error: "Manda una foto (JPG, PNG o WebP) o un PDF." }, 415);
  const archivo = Buffer.from(await request.arrayBuffer());
  if (!archivo.length || archivo.length > MAX_BYTES)
    return json({ error: "El archivo es demasiado grande (máximo 4 MB)." }, 413);
  try {
    return json(await leerCarta(archivo, tipo as TipoCarta));
  } catch (e) {
    if (e instanceof CartaIlegible) return json({ error: e.message }, 422);
    if (e instanceof IaSaturada)
      return json({ error: "Hay mucha gente leyendo cartas. Prueba en un minuto." }, 429);
    return json({ error: "No se ha podido leer la carta. Prueba otra vez en un momento." }, 502);
  }
}
