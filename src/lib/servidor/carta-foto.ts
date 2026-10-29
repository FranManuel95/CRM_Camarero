import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { ALERGENOS } from "../dominio/tipos";

/**
 * Lee la foto (o el PDF) de la carta de un bar con Claude y devuelve categorías y platos con su
 * precio, para darlos de alta de golpe. Solo funciona si el servidor tiene ANTHROPIC_API_KEY.
 */

const esquema = z.object({
  categorias: z.array(
    z.object({
      nombre: z.string().describe("Nombre de la sección de la carta, p. ej. «Tapas» o «Cervezas»"),
      destino: z
        .enum(["cocina", "barra"])
        .describe("cocina si es comida; barra si es bebida, café o algo que sirve la barra"),
      productos: z.array(
        z.object({
          nombre: z.string().describe("Nombre del plato o bebida tal como sale en la carta"),
          descripcion: z.string().describe("Descripción si la carta la trae; vacío si no"),
          precio: z
            .number()
            .describe("Precio en euros con IVA (el de la ración si hay varios); 0 si no se lee"),
          alergenos: z
            .array(z.enum(ALERGENOS))
            .describe(
              "Solo los alérgenos que la carta indica expresamente; vacío si no los indica",
            ),
        }),
      ),
    }),
  ),
});

export type LecturaCarta = z.infer<typeof esquema>;

export const TIPOS_CARTA = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type TipoCarta = (typeof TIPOS_CARTA)[number];

export class CartaIlegible extends Error {}

export async function leerCarta(archivo: Buffer, tipo: TipoCarta): Promise<LecturaCarta> {
  const datos = archivo.toString("base64");
  const cliente = new Anthropic();
  const respuesta = await cliente.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(esquema) },
    // Si los filtros de seguridad rechazan la petición, la repite otro modelo en la misma llamada.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      "Pasas a datos la carta de un bar o restaurante de España. Respeta las secciones de la " +
      "carta como categorías y copia los nombres tal cual. Si un plato tiene varios precios " +
      "(tapa, media, ración), crea un producto por cada uno con el tamaño en el nombre " +
      "(«Croquetas (media)»). Los alérgenos, solo si la carta los indica; no los deduzcas. " +
      "No inventes nada: si un precio no se lee, pon 0.",
    messages: [
      {
        role: "user",
        content: [
          tipo === "application/pdf"
            ? { type: "document", source: { type: "base64", media_type: tipo, data: datos } }
            : { type: "image", source: { type: "base64", media_type: tipo, data: datos } },
          { type: "text", text: "Esta es la carta." },
        ],
      },
    ],
  });
  if (respuesta.stop_reason === "refusal" || !respuesta.parsed_output)
    throw new CartaIlegible("No se ha podido leer la carta. Prueba con otra foto más nítida.");
  const lectura = respuesta.parsed_output;
  if (!lectura.categorias.some((c) => c.productos.length))
    throw new CartaIlegible("No veo platos en esa foto. Prueba con otra más nítida.");
  return lectura;
}
