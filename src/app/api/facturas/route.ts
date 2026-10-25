import Anthropic from "@anthropic-ai/sdk";
import { activa } from "@/lib/dominio/funciones";
import { pedidoDeFactura } from "@/lib/dominio/stock";
import { leerEstado } from "@/lib/servidor/almacen";
import { FacturaIlegible, leerFactura, TIPOS_FOTO, type TipoFoto } from "@/lib/servidor/facturas";
import { json } from "@/lib/servidor/respuestas";
import { sesionActual } from "@/lib/servidor/sesion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

/** Recibe la foto de una factura (el cuerpo es la imagen) y devuelve el pedido leído. */
export async function POST(request: Request) {
  const sesion = await sesionActual();
  if (sesion?.empleado.rol !== "encargado")
    return json({ error: "Solo un encargado puede recibir pedidos." }, 403);
  if (!process.env.ANTHROPIC_API_KEY)
    return json({ error: "La lectura de facturas no está activada en este servidor." }, 404);
  const tipo = request.headers.get("content-type") ?? "";
  if (!TIPOS_FOTO.includes(tipo as TipoFoto))
    return json({ error: "Manda una foto (JPG, PNG o WebP)." }, 415);
  const foto = Buffer.from(await request.arrayBuffer());
  if (!foto.length || foto.length > MAX_BYTES)
    return json({ error: "La foto es demasiado grande." }, 413);

  const estado = await leerEstado(sesion.local);
  if (!activa(estado.ajustes, "stock") || !activa(estado.ajustes, "facturasConFoto"))
    return json({ error: "La lectura de facturas está apagada en este bar." }, 404);
  if (!estado.ingredientes.length)
    return json({ error: "Da de alta los ingredientes antes de leer facturas." }, 409);
  try {
    const lectura = await leerFactura(foto, tipo as TipoFoto, estado.ingredientes);
    return json(pedidoDeFactura(lectura, estado.ingredientes));
  } catch (e) {
    if (e instanceof FacturaIlegible) return json({ error: e.message }, 422);
    if (e instanceof Anthropic.RateLimitError)
      return json({ error: "Hay mucha gente leyendo facturas. Prueba en un minuto." }, 429);
    if (e instanceof Anthropic.APIError) {
      console.error("Lectura de factura:", e.status, e.message);
      return json({ error: "No se ha podido leer la factura. Prueba otra vez." }, 502);
    }
    throw e;
  }
}
