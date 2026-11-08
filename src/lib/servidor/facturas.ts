import { z } from "zod/v4";
import type { LecturaFactura } from "../dominio/stock";
import type { Ingrediente } from "../dominio/tipos";
import { IaSinRespuesta, leerConIa } from "./ia";

/**
 * Lee la foto de una factura o un albarán de proveedor con Claude y devuelve las líneas casadas
 * con los ingredientes del almacén. Usa la IA que tenga el servidor (`ia.ts`).
 */

const esquema = z.object({
  proveedor: z.string().describe("Nombre del proveedor tal y como sale en la factura"),
  iva: z.number().describe("Tipo de IVA principal de la factura en % (0, 4, 10 o 21)"),
  lineas: z.array(
    z.object({
      ingredienteId: z
        .string()
        .nullable()
        .describe("Id del ingrediente de la lista que corresponde a la línea, o null si ninguno"),
      descripcion: z.string().describe("Texto de la línea en la factura"),
      cantidad: z
        .number()
        .describe("Cantidad pasada a la unidad del ingrediente (kg, l o ud); 0 si no se sabe"),
      importe: z
        .number()
        .describe("Importe de la línea en euros con IVA incluido; 0 si no se sabe"),
    }),
  ),
});

export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoFoto = (typeof TIPOS_FOTO)[number];

export class FacturaIlegible extends Error {}

export async function leerFactura(
  foto: Buffer,
  tipo: TipoFoto,
  ingredientes: Ingrediente[],
): Promise<LecturaFactura> {
  const lista = ingredientes.map((i) => `${i.id}: ${i.nombre} (${i.unidad})`).join("\n");
  try {
    return await leerConIa({
      sistema:
        "Lees facturas y albaranes de proveedores de un bar en España. Para cada línea de " +
        "producto, búscale el ingrediente del almacén que corresponde y pasa la cantidad a la " +
        "unidad de ese ingrediente (por ejemplo, «2 cajas de 5 kg» son 10 kg; «1 barril de 30 l» " +
        "son 30 l; «2 docenas de huevos» son 24 ud). Si una línea no corresponde a ningún " +
        "ingrediente (portes, envases, descuentos), pon ingredienteId a null. No inventes datos: " +
        "lo que no se lea bien, déjalo a 0.",
      texto: `Ingredientes del almacén (id: nombre (unidad)):\n${lista}`,
      archivo: { datos: foto, tipo },
      esquema,
    });
  } catch (e) {
    if (e instanceof IaSinRespuesta)
      throw new FacturaIlegible("No se ha podido leer la factura. Prueba con otra foto.");
    throw e;
  }
}
