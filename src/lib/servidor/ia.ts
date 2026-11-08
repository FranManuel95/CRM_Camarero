import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { registrar } from "./registro";

/**
 * Lectura de fotos y PDF con IA de cualquier proveedor, en cadena: se prueba el primero que esté
 * configurado y, si está saturado, falla o devuelve algo que no cuadra, el siguiente. Por defecto
 * va primero lo gratuito (Gemini de Google AI Studio), luego cualquier API compatible con OpenAI
 * (OpenRouter, Mistral, Groq, OpenAI, DeepSeek…) y al final Claude. Variables:
 *
 * - `GEMINI_API_KEY` (+ `GEMINI_MODELO`, por defecto gemini-2.5-flash).
 * - `IA_URL`, `IA_CLAVE`, `IA_MODELO`: la API compatible con OpenAI (la URL acaba en /v1 o
 *   similar; se le añade /chat/completions). `IA_PDF=1` si ese modelo acepta PDF.
 * - `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODELO`).
 * - `IA_ORDEN`: el orden, p. ej. «compatible,gemini,anthropic». Por defecto gemini,compatible,anthropic.
 */

export type ArchivoIa = { datos: Buffer; tipo: string };
export type PeticionIa<T extends z.ZodType> = {
  sistema: string;
  texto: string;
  archivo: ArchivoIa;
  esquema: T;
};

type Proveedor = {
  nombre: string;
  aceptaPdf: boolean;
  leer: (p: PeticionIa<z.ZodType>) => Promise<unknown>;
};

/** Todos los proveedores están saturados (límite de uso): mejor esperar un poco. */
export class IaSaturada extends Error {}
/** Ningún proveedor ha podido leerlo. */
export class IaFallida extends Error {}
/** El modelo dice que no se puede (respuesta vacía o rechazo): no tiene sentido insistir. */
export class IaSinRespuesta extends Error {}

/** Hay IA, pero ninguna de las configuradas acepta este tipo de archivo (PDF). */
export class IaSinFormato extends Error {}

class Saturado extends Error {}

const NOMBRES = ["gemini", "compatible", "anthropic"] as const;
type NombreProveedor = (typeof NOMBRES)[number];

export function proveedoresIa(entorno: NodeJS.ProcessEnv = process.env): NombreProveedor[] {
  const hay: Record<NombreProveedor, boolean> = {
    gemini: Boolean(entorno.GEMINI_API_KEY),
    compatible: Boolean(entorno.IA_URL && entorno.IA_CLAVE && entorno.IA_MODELO),
    anthropic: Boolean(entorno.ANTHROPIC_API_KEY),
  };
  const pedido = (entorno.IA_ORDEN ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is NombreProveedor => (NOMBRES as readonly string[]).includes(s));
  const orden = [...new Set([...pedido, ...NOMBRES])];
  return orden.filter((n) => hay[n]);
}

export const hayIa = () => proveedoresIa().length > 0;

/** Instrucciones de formato para los modelos que no reciben el esquema por la API. */
function conEsquema(sistema: string, esquema: z.ZodType) {
  return (
    `${sistema}\n\nResponde SOLO con un objeto JSON (sin texto alrededor ni bloques de código) ` +
    `que cumpla este esquema JSON:\n${JSON.stringify(z.toJSONSchema(esquema))}`
  );
}

/** Saca el JSON de la respuesta aunque venga envuelto en ```json … ```. */
export function extraerJson(texto: string): unknown {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio < 0 || fin < inicio) throw new Error("La respuesta no trae JSON");
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

async function pedir(url: string, init: RequestInit, segundos = 90) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(segundos * 1000) });
  if (r.status === 429) throw new Saturado(`${r.status}`);
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json() as Promise<unknown>;
}

const gemini = (entorno: NodeJS.ProcessEnv): Proveedor => ({
  nombre: "gemini",
  aceptaPdf: true,
  async leer({ sistema, texto, archivo, esquema }) {
    const modelo = entorno.GEMINI_MODELO || "gemini-2.5-flash";
    const r = (await pedir(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": entorno.GEMINI_API_KEY ?? "",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: conEsquema(sistema, esquema) }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: { mimeType: archivo.tipo, data: archivo.datos.toString("base64") },
                },
                { text: texto },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const salida = r.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!salida) throw new IaSinRespuesta("Respuesta vacía");
    return extraerJson(salida);
  },
});

const compatible = (entorno: NodeJS.ProcessEnv): Proveedor => ({
  nombre: "compatible",
  aceptaPdf: entorno.IA_PDF === "1",
  async leer({ sistema, texto, archivo, esquema }) {
    const base = (entorno.IA_URL ?? "").replace(/\/+$/, "");
    const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
    const dataUrl = `data:${archivo.tipo};base64,${archivo.datos.toString("base64")}`;
    const adjunto =
      archivo.tipo === "application/pdf"
        ? { type: "file", file: { filename: "carta.pdf", file_data: dataUrl } }
        : { type: "image_url", image_url: { url: dataUrl } };
    const r = (await pedir(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${entorno.IA_CLAVE ?? ""}`,
      },
      body: JSON.stringify({
        model: entorno.IA_MODELO,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: conEsquema(sistema, esquema) },
          { role: "user", content: [adjunto, { type: "text", text: texto }] },
        ],
      }),
    })) as { choices?: { message?: { content?: string | null } }[] };
    const salida = r.choices?.[0]?.message?.content ?? "";
    if (!salida) throw new IaSinRespuesta("Respuesta vacía");
    return extraerJson(salida);
  },
});

const anthropic = (entorno: NodeJS.ProcessEnv): Proveedor => ({
  nombre: "anthropic",
  aceptaPdf: true,
  async leer({ sistema, texto, archivo, esquema }) {
    const cliente = new Anthropic({ apiKey: entorno.ANTHROPIC_API_KEY });
    const datos = archivo.datos.toString("base64");
    try {
      const respuesta = await cliente.beta.messages.parse({
        model: entorno.ANTHROPIC_MODELO || "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "medium", format: betaZodOutputFormat(esquema) },
        // Si los filtros de seguridad rechazan la petición, la repite otro modelo en la misma llamada.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: sistema,
        messages: [
          {
            role: "user",
            content: [
              archivo.tipo === "application/pdf"
                ? {
                    type: "document",
                    source: { type: "base64", media_type: "application/pdf", data: datos },
                  }
                : {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: archivo.tipo as "image/jpeg" | "image/png" | "image/webp",
                      data: datos,
                    },
                  },
              { type: "text", text: texto },
            ],
          },
        ],
      });
      if (respuesta.stop_reason === "refusal" || !respuesta.parsed_output)
        throw new IaSinRespuesta("Sin respuesta");
      return respuesta.parsed_output;
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new Saturado("429");
      throw e;
    }
  },
});

const FABRICAS: Record<NombreProveedor, (e: NodeJS.ProcessEnv) => Proveedor> = {
  gemini,
  compatible,
  anthropic,
};

/**
 * Lee el archivo con el primer proveedor que responda bien. Lo que devuelve ya está comprobado
 * contra el esquema.
 */
export async function leerConIa<T extends z.ZodType>(
  peticion: PeticionIa<T>,
  entorno: NodeJS.ProcessEnv = process.env,
): Promise<z.infer<T>> {
  const todos = proveedoresIa(entorno).map((n) => FABRICAS[n](entorno));
  const proveedores = todos.filter(
    (p) => p.aceptaPdf || peticion.archivo.tipo !== "application/pdf",
  );
  if (!todos.length) throw new IaFallida("No hay ninguna IA configurada.");
  if (!proveedores.length) throw new IaSinFormato("Ninguna IA configurada acepta este archivo.");
  let saturados = 0;
  let sinRespuesta = 0;
  for (const p of proveedores) {
    const inicio = Date.now();
    try {
      const bruto = await p.leer(peticion as PeticionIa<z.ZodType>);
      const valido = peticion.esquema.safeParse(bruto);
      if (!valido.success) throw new Error(`No cumple el esquema: ${valido.error.message}`);
      registrar("info", "ia", { proveedor: p.nombre, ms: Date.now() - inicio });
      return valido.data as z.infer<T>;
    } catch (e) {
      if (e instanceof Saturado) saturados++;
      if (e instanceof IaSinRespuesta) sinRespuesta++;
      registrar("aviso", "ia_fallo", {
        proveedor: p.nombre,
        ms: Date.now() - inicio,
        motivo: e instanceof Saturado ? "saturado" : String((e as Error).message).slice(0, 300),
      });
    }
  }
  if (saturados === proveedores.length) throw new IaSaturada("Saturada");
  if (sinRespuesta === proveedores.length) throw new IaSinRespuesta("Sin respuesta");
  throw new IaFallida("Ningún proveedor ha podido leerlo.");
}
