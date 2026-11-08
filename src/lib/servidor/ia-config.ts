/** Qué IA tiene configurada el servidor y en qué orden se prueban (ver `ia.ts`). */

export const NOMBRES = ["gemini", "compatible", "anthropic"] as const;
export type NombreProveedor = (typeof NOMBRES)[number];

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
